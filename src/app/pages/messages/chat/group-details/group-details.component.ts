import { CommonModule } from '@angular/common';
import {
  Component,
  Input,
  OnInit,
  EnvironmentInjector,
  runInInjectionContext,
} from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, IonicModule, ModalController } from '@ionic/angular';
import { combineLatest, Observable, of } from 'rxjs';
import { map, switchMap, startWith, catchError } from 'rxjs/operators';
import { UsersService } from 'src/app/services/users.service';
import { ChatService } from 'src/app/services/chat.service';
import { UtilitiesService } from 'src/app/services/utilities.service';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { addIcons } from 'ionicons';
import { close, personRemoveOutline, peopleOutline, exitOutline } from 'ionicons/icons';

interface GroupMember {
  uid: string;
  displayName: string;
  email: string | null;
  photoURL: string | null;
  role: string | null;
  isOnline: boolean;
  isCreator: boolean;
  isSelf: boolean;
}

@Component({
  selector: 'app-group-details',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './group-details.component.html',
  styleUrls: ['./group-details.component.scss'],
})
export class GroupDetailsComponent implements OnInit {
  @Input() chat: any;
  @Input() chatId: string | null = null;
  @Input() currentUid: string | null = null;

  chat$: Observable<any> = of(null);
  members$: Observable<GroupMember[]> = of([]);

  groupName = 'Group';
  creatorUid: string | null = null;

  constructor(
    private modalCtrl: ModalController,
    private usersService: UsersService,
    private chatService: ChatService,
    private utils: UtilitiesService,
    private alertCtrl: AlertController,
    private afs: AngularFirestore,
    private router: Router,
    private envInjector: EnvironmentInjector
  ) {
    addIcons({ close, personRemoveOutline, peopleOutline, exitOutline });
  }

  ngOnInit(): void {
    this.chat$ = this.chatId
      ? runInInjectionContext(this.envInjector, () =>
          this.afs.doc(`chats/${this.chatId}`).valueChanges()
        ).pipe(map((c: any) => ({ id: this.chatId, ...(c || {}) })))
      : of(this.chat);

    this.members$ = this.chat$.pipe(
      switchMap((c: any) => {
        // The live valueChanges() doc can come back empty/undefined; the chat
        // page already loaded the full group doc, so fall back to the passed
        // `chat` whenever the live doc has no member data.
        const liveHasData = !!(c && (c.members || c.uids || c.messages));
        const doc = liveHasData ? c : this.chat || c || {};

        this.groupName = doc?.displayName || this.chat?.displayName || 'Group';
        this.creatorUid = doc?.createdBy || doc?.uid || null;

        // Collect member uids from members[], uids[], message authors, creator.
        const embedded: any[] = Array.isArray(doc?.members) ? doc.members : [];
        const embByUid = new Map<string, any>();
        embedded.forEach((m) => m?.uid && embByUid.set(m.uid, m));

        const uidSet = new Set<string>();
        embedded.forEach((m) => m?.uid && uidSet.add(m.uid));
        (Array.isArray(doc?.uids) ? doc.uids : []).forEach(
          (u: any) => typeof u === 'string' && u && uidSet.add(u)
        );
        (Array.isArray(doc?.messages) ? doc.messages : []).forEach(
          (m: any) => typeof m?.uid === 'string' && m.uid && uidSet.add(m.uid)
        );
        if (this.creatorUid) uidSet.add(this.creatorUid);

        const uids = Array.from(uidSet);
        if (!uids.length) {
          return of<GroupMember[]>([]);
        }

        const build = (u: any, uid: string): GroupMember => {
          const emb = embByUid.get(uid) || {};
          const role =
            typeof u?.role === 'string'
              ? u.role
              : typeof u?.role?.name === 'string'
                ? u.role.name
                : null;
          return {
            uid,
            displayName: u?.displayName || emb.displayName || emb.email || 'Member',
            email: u?.email || emb.email || null,
            photoURL: u?.photoURL || emb.photoURL || null,
            role,
            isOnline: u?.isOnline === true,
            isCreator: uid === this.creatorUid,
            isSelf: uid === this.currentUid,
          };
        };

        // Resolve each member's live profile, but emit immediately from the
        // embedded data (startWith) so the list never stalls on the lookup.
        return combineLatest(
          uids.map((uid) =>
            this.usersService.getUserById(uid).pipe(
              map((u: any) => build(u, uid)),
              startWith(build(null, uid)),
              catchError(() => of(build(null, uid)))
            )
          )
        ).pipe(
          map((list) =>
            [...list].sort((a, b) => {
              if (a.isCreator !== b.isCreator) return a.isCreator ? -1 : 1;
              return a.displayName.localeCompare(b.displayName);
            })
          )
        );
      })
    );
  }

  // Only the group creator can remove members.
  get isCreator(): boolean {
    return !!this.currentUid && !!this.creatorUid && this.currentUid === this.creatorUid;
  }

  canRemove(member: GroupMember): boolean {
    return this.isCreator && !member.isSelf && !member.isCreator;
  }

  async removeMember(member: GroupMember): Promise<void> {
    if (!this.canRemove(member) || !this.chatId) return;

    const alert = await this.alertCtrl.create({
      header: 'Remove member',
      message: `Remove ${member.displayName} from "${this.groupName}"?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Remove',
          role: 'destructive',
          handler: async () => {
            try {
              await this.chatService.removeGroupMember(this.chatId!, member.uid);
              this.utils.presentToast(`${member.displayName} removed`);
            } catch (err) {
              console.error('Remove member failed:', err);
              this.utils.presentToast('Failed to remove member');
            }
          },
        },
      ],
    });
    await alert.present();
  }

  async leaveGroup(): Promise<void> {
    if (!this.currentUid || !this.chatId) return;

    const alert = await this.alertCtrl.create({
      header: 'Leave group',
      message: `Leave "${this.groupName}"? You'll stop receiving its messages.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Leave',
          role: 'destructive',
          handler: async () => {
            try {
              await this.chatService.removeGroupMember(this.chatId!, this.currentUid!);
              await this.close();
              this.router.navigateByUrl('/messages');
            } catch (err) {
              console.error('Leave group failed:', err);
              this.utils.presentToast('Failed to leave group');
            }
          },
        },
      ],
    });
    await alert.present();
  }

  close(): Promise<boolean> {
    return this.modalCtrl.dismiss();
  }
}
