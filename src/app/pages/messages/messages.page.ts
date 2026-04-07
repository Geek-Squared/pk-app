import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
} from '@angular/core';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { GestureController, IonicModule, ModalController } from '@ionic/angular';
import { AuthenticationService } from 'src/app/services/authentication.service';
import { ChatService } from 'src/app/services/chat.service';
import { UsersService } from 'src/app/services/users.service';
import { RouterModule } from '@angular/router';
import { BackButtonComponent } from 'src/app/components/back-button/back-button.component';
import { UserSelectionComponent } from './user-selection/user-selection.component';
import { FormsModule } from '@angular/forms';
import { TitleService } from 'src/app/services/title.service';

@Component({
  selector: 'app-messages',
  templateUrl: './messages.page.html',
  styleUrls: ['./messages.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule, BackButtonComponent, FormsModule]
})
export class MessagesPage implements OnInit {
  searchTerm$ = new BehaviorSubject<string>('');
  
  userChats$: Observable<any>;
  groupChats$: Observable<any>;
  filteredChats$: Observable<any>;
  filteredGroups$: Observable<any>;
  availableUsers$: Observable<any>;
  
  currentUser: any;

  constructor(
    public auth: AuthenticationService,
    public cs: ChatService,
    public gestureCtrl: GestureController,
    private usersService: UsersService,
    private modalController: ModalController,
    private titleService: TitleService
  ) {}

  ngOnInit() {
    this.titleService.setTitle('Network');
    
    this.auth.user$.pipe(take(1)).subscribe(user => {
      this.currentUser = user;
    });
    
    this.userChats$ = this.cs.getUserChats();
    this.groupChats$ = this.cs.getGroupChats();

    // Filtered My Team (Existing Individual Chats)
    this.filteredChats$ = combineLatest([this.userChats$, this.searchTerm$]).pipe(
      map(([chats, term]) => {
        if (!chats) return [];
        return chats.filter(c => 
          c.recipientName?.toLowerCase().includes(term.toLowerCase())
        );
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
        
        let available = users.filter(u => u.uid !== this.currentUser?.uid && u.role === 'counsellor');
        
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
