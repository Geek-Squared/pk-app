import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { IonicModule, ModalController } from '@ionic/angular';
import { combineLatest, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { UsersService } from 'src/app/services/users.service';
import { AngularFirestore } from '@angular/fire/compat/firestore';

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

  members$ = of<any[]>([]);
  chat$ = of<any>(null);

  constructor(
    private modalCtrl: ModalController,
    private usersService: UsersService,
    private afs: AngularFirestore
  ) {}

  ngOnInit(): void {
    // Live source of truth for member list: subscribe to the chat doc.
    if (this.chatId) {
      this.chat$ = this.afs
        .doc(`chats/${this.chatId}`)
        .valueChanges()
        .pipe(map((c: any) => ({ id: this.chatId, ...(c || {}) })));
    } else {
      this.chat$ = of(this.chat);
    }

    this.members$ = this.chat$.pipe(
      switchMap((c: any) => {
        const members = Array.isArray(c?.members) ? c.members : [];
        if (members.length) {
          return of(
            members
              .map((m: any) => ({
                uid: m?.uid || null,
                displayName: m?.displayName || null,
                email: m?.email || null,
                photoURL: m?.photoURL || m?.photoUrl || null,
              }))
              .filter((m: any) => !!m.uid)
          );
        }

        const uids: string[] = Array.isArray(c?.uids) ? c.uids : [];
        const unique = Array.from(
          new Set(uids.filter((u) => typeof u === 'string' && u))
        );
        if (!unique.length) {
          return of([]);
        }

        const obs = unique.map((uid) => this.usersService.getUserById(uid));
        return combineLatest(obs).pipe(
          map((arr: any[]) =>
            arr
              .map((u: any, idx: number) => ({
                uid: unique[idx],
                displayName: u?.displayName || null,
                email: u?.email || null,
                photoURL: u?.photoURL || u?.photoUrl || null,
              }))
              .filter((m: any) => !!m.uid)
          )
        );
      })
    );
  }

  close(): void {
    this.modalCtrl.dismiss();
  }
}
