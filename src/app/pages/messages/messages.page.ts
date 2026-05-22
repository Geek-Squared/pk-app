import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
} from '@angular/core';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import {
  IonicModule,
  ModalController,
  ToastController,
} from '@ionic/angular';
import { AuthenticationService } from 'src/app/services/authentication.service';
import { ChatService } from 'src/app/services/chat.service';
import { UsersService } from 'src/app/services/users.service';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { BackButtonComponent } from 'src/app/components/back-button/back-button.component';
import { UserSelectionComponent } from './user-selection/user-selection.component';
import { FormsModule } from '@angular/forms';
import { TitleService } from 'src/app/services/title.service';
import { AngularFireFunctions } from '@angular/fire/compat/functions';

@Component({
  selector: 'app-messages',
  templateUrl: './messages.page.html',
  styleUrls: ['./messages.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule, BackButtonComponent, FormsModule]
})
export class MessagesPage implements OnInit {
  searchTerm$ = new BehaviorSubject<string>('');
  public currentUserRole$ = new BehaviorSubject<string>('');
  private roleLoaded$ = new BehaviorSubject<boolean>(false);

  userChats$: Observable<any>;
  groupChats$: Observable<any>;
  filteredChats$: Observable<any>;
  filteredCounsellorChats$: Observable<any>;
  filteredOtherChats$: Observable<any>;
  filteredGroups$: Observable<any>;
  availableUsers$: Observable<any>;
  canCreateGroup$: Observable<boolean>;
  isClientRole$: Observable<boolean>;

  currentUser: any;
  public mode: 'default' | 'counsellors' = 'default';

  constructor(
    public auth: AuthenticationService,
    public cs: ChatService,
    private usersService: UsersService,
    private modalController: ModalController,
    private titleService: TitleService,
    private route: ActivatedRoute,
    private router: Router,
    private fns: AngularFireFunctions,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    this.mode = (this.route.snapshot.data?.mode as any) === 'counsellors'
      ? 'counsellors'
      : 'default';

    this.titleService.setTitle(this.mode === 'counsellors' ? 'Counsellors' : 'Network');
    
    const uid = JSON.parse(localStorage.getItem('user') || '{}')?.uid;
    this.currentUser = { uid };
    if (uid) {
      this.usersService.getUserById(uid).pipe(take(1)).subscribe((firestoreUser: any) => {
        this.currentUser = firestoreUser;
        const role = typeof firestoreUser?.role === 'string' ? firestoreUser.role : '';
        this.currentUserRole$.next(role.toLowerCase());
        this.roleLoaded$.next(true);
      });
    } else {
      this.roleLoaded$.next(true);
    }

    this.isClientRole$ = combineLatest([this.currentUserRole$, this.roleLoaded$]).pipe(
      map(([role, loaded]) => loaded && role !== 'counsellor')
    );

    this.canCreateGroup$ = this.currentUserRole$.pipe(
      map(role => role === 'counsellor' || role === 'administrator')
    );
    
    this.userChats$ = this.cs.getUserChats();
    this.groupChats$ = this.cs.getGroupChats();

    // Filtered My Team (Existing Individual Chats)
    this.filteredChats$ = combineLatest([this.userChats$, this.searchTerm$]).pipe(
      map(([chats, term]) => {
        if (!chats) return [];
        return chats.filter(c =>
          c.type !== 'group' &&
          c.recipientName?.toLowerCase().includes(term.toLowerCase())
        );
      })
    );

    // Counsellor sessions:
    // - For non-counsellors: only chats where the other participant is a counsellor (or chats created via request flow)
    // - For counsellors: show all private chats (their recipients are clients, not counsellors)
    this.filteredCounsellorChats$ = combineLatest([
      this.filteredChats$,
      this.currentUserRole$,
    ]).pipe(
      map(([chats, roleLower]: [any[], string]) => {
        const list = Array.isArray(chats) ? chats : [];
        if (roleLower === 'counsellor') {
          return list;
        }
        return list.filter((c) => {
          const recipientRoleLower = `${c?.recipientRole ?? ''}`.toLowerCase();
          return recipientRoleLower === 'counsellor' || !!c?.request;
        });
      })
    );

    // "My Team" (Network mode): for counsellors shows all their private sessions;
    // for regular users excludes counsellor chats (those live in the Counsellors tab).
    this.filteredOtherChats$ = combineLatest([
      this.filteredChats$,
      this.currentUserRole$,
    ]).pipe(
      map(([chats, roleLower]: [any[], string]) => {
        const list = Array.isArray(chats) ? chats : [];
        if (roleLower === 'counsellor') {
          return list;
        }
        return list.filter((c) => {
          const recipientRoleLower = `${c?.recipientRole ?? ''}`.toLowerCase();
          return recipientRoleLower !== 'counsellor' && !c?.request;
        });
      })
    );

    // Filtered Community Spaces (Group Chats)
    this.filteredGroups$ = combineLatest([this.groupChats$, this.searchTerm$]).pipe(
      map(([groups, term]) => {
        if (!groups) return [];
        return groups.filter(g => 
          g.displayName?.toLowerCase().includes(term.toLowerCase())
        );
      })
    );

    // Available Counselors (Discovery)
    const allUsers$ = this.usersService.getUsers().pipe(
      map(actions => actions.map(a => {
        const data: any = a.payload.doc.data();
        const id = a.payload.doc.id;
        return { id, uid: id, ...data };
      }))
    );

    this.availableUsers$ = combineLatest([allUsers$, this.userChats$, this.searchTerm$]).pipe(
      map(([users, chats, term]) => {
        if (!users) return [];
        
        let available = users.filter(
          (u) =>
            u.uid !== this.currentUser?.uid &&
            `${u.role ?? ''}`.toLowerCase() === 'counsellor'
        );
        
        const chattedUids = chats?.map(c => c.recipientId) || [];
        available = available.filter(u => !chattedUids.includes(u.uid));
        
        if (term) {
          available = available.filter(u => 
            u.displayName?.toLowerCase().includes(term.toLowerCase()) ||
            u.email?.toLowerCase().includes(term.toLowerCase())
          );
        }

        return available;
      })
    );
  }

  onSearchChange(event: any) {
    this.searchTerm$.next(event.target.value);
  }

  startNewChat(user: any) {
    this.cs.create(user);
  }

  async showUserSelection(isGroup: boolean = false) {
    if (isGroup) {
      const role = this.currentUserRole$.getValue();
      if (role !== 'counsellor' && role !== 'administrator') {
        return;
      }
    }

    const modal = await this.modalController.create({
      component: UserSelectionComponent,
      componentProps: { isGroup }
    });

    await modal.present();

    const { data } = await modal.onWillDismiss();
    if (data) {
      if (data.mode === 'group') {
        this.cs.createGroup(data.name, data.members);
      } else {
        this.cs.create(data.user);
      }
    }
  }

  public goToCounsellors(): void {
    this.router.navigateByUrl('/messages/counsellors');
  }

  public goToNetwork(): void {
    this.router.navigateByUrl('/messages');
  }

  public async requestCounsellor(): Promise<void> {
    const callable = this.fns.httpsCallable('requestCounsellorChat');
    const res = await callable({}).toPromise();

    const chatId = (res as any)?.chatId || null;
    const available = (res as any)?.available !== false;
    const counsellorUid = (res as any)?.counsellorUid || null;

    if (!available || !chatId) {
      const toast = await this.toastController.create({
        message: 'No counsellor is available right now.',
        duration: 3000,
        position: 'top',
      });
      await toast.present();
      return;
    }

    console.log('[CounsellorRequest] Assigned', { chatId, counsellorUid });
    this.router.navigateByUrl(`/messages/chat/${chatId}`);
  }

  getTotalUnread(chat: any) {
    const userUid = this.currentUser?.uid;
    const hasReadCount = chat?.hasRead?.[userUid];
    const totalMessages = chat?.messages?.length || 0;

    if (chat?.hasRead && hasReadCount !== undefined) {
      const unreadCount = totalMessages - hasReadCount;
      return unreadCount > 0 ? unreadCount : 0;
    } else {
      return totalMessages;
    }
  }
}
