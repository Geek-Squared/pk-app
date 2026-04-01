import { Injectable, Injector, runInInjectionContext } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';

import { AuthenticationService } from './authentication.service';
import { map, switchMap, tap } from 'rxjs/operators';
import { combineLatest, Observable, of } from 'rxjs';

import firebase from 'firebase/compat/app';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { UsersService } from './users.service';
import { environment } from 'src/environments/environment';

interface Member {
  deviceId: {
    value: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  constructor(
    private afs: AngularFirestore,
    private auth: AuthenticationService,
    private router: Router,
    private http: HttpClient,
    private usersService: UsersService,
    private injector: Injector
  ) {}

  get(chatId) {
    return runInInjectionContext(this.injector, () => {
      return this.afs
        .collection<any>('chats')
        .doc(chatId)
        .snapshotChanges()
        .pipe(
          map((doc: any) => {
            return { id: doc.payload.id, ...doc.payload.data() };
          })
        );
    });
  }

  getUserChats() {
    return this.auth.user$.pipe(
      switchMap((user) => {
        if (!user) return of([]);
        return runInInjectionContext(this.injector, () => {
          return this.afs
            .collection('chats', (ref) =>
              ref.where('uids', 'array-contains', user.uid)
            )
            .snapshotChanges()
            .pipe(
              switchMap((actions) => {
                const chats = actions.map((a) => {
                  const data: any = a.payload.doc.data();
                  const id = a.payload.doc.id;
                  return { id, ...data };
                });

                if (chats.length === 0) return of([]);

                const joins = chats.map((chat) => {
                  const recipientUid = chat.uids?.find(uid => uid !== user.uid);
                  if (!recipientUid) return of(chat);
                  
                  return runInInjectionContext(this.injector, () => {
                    return this.afs.doc(`users/${recipientUid}`).valueChanges().pipe(
                      map((u: any) => ({ ...chat, recipientOnline: u?.isOnline || false }))
                    );
                  });
                });

                return combineLatest(joins);
              })
            );
        });
      })
    );
  }

  getGroupChats() {
    return this.auth.user$.pipe(
      switchMap((user) => {
        if (!user) return of([]);
        return runInInjectionContext(this.injector, () => {
          return this.afs
            .collection('chats', (ref) => 
               ref.where('type', '==', 'group')
                  .where('uids', 'array-contains', user.uid)
            )
            .snapshotChanges()
            .pipe(
              map((actions) =>
                actions.map((a) => {
                  const data: any = a.payload.doc.data();
                  const id = a.payload.doc.id;
                  return { id, ...data };
                })
              )
            );
        });
      })
    );
  }

  async create(recipientUser?: any) {
    const user = await this.auth.getUser();

    const data = {
      uid: user.uid,
      uids: recipientUser ? [user.uid, recipientUser.uid] : [user.uid],
      recipientName: recipientUser
        ? recipientUser.displayName || recipientUser.email
        : 'Private Chat',
      createdAt: Date.now(),
      count: 0,
      messages: [],
      type: recipientUser ? 'private' : 'private',
    };

    return runInInjectionContext(this.injector, () => {
      return this.afs
        .collection('chats')
        .add(data)
        .then((docRef) => {
          this.router.navigate(['messages/chat', docRef.id]);
        });
    });
  }

  async createGroup(name: string, members: any[]) {
    const user = await this.auth.getUser();
    const memberUids = [user.uid, ...members.map(m => m.uid)];
    
    const data = {
      displayName: name,
      uids: memberUids,
      type: 'group',
      createdAt: Date.now(),
      count: 0,
      messages: [],
      members: [
        {
          uid: user.uid,
          displayName: user.displayName || user.email,
          photoURL: user.photoURL || ''
        },
        ...members.map(m => ({
          uid: m.uid,
          displayName: m.displayName || m.email,
          photoURL: m.photoURL || ''
        }))
      ]
    };

    return runInInjectionContext(this.injector, () => {
      return this.afs
        .collection('chats')
        .add(data)
        .then((docRef) => {
          this.router.navigate(['messages/chat', docRef.id]);
        });
    });
  }

  async updateGroupMembers(chatId: string, uid: string, memberObj: any) {
    return this.afs.collection('chats').doc(chatId).update({
      uids: firebase.firestore.FieldValue.arrayUnion(uid),
      members: firebase.firestore.FieldValue.arrayUnion(memberObj)
    });
  }

  async sendMessage(chatId, content, recipientUid?, members?, type?) {
    const user = await this.auth.getUser();

    const data = {
      uid: user.uid,
      content,
      createdAt: Date.now(),
      user: {
        uid: user.uid,
        displayName: user.displayName || user.email,
        photoURL: user.photoURL || '',
      },
      type: type || 'text',
    };

    if (chatId) {
      return runInInjectionContext(this.injector, () => {
        const ref = this.afs.collection('chats').doc(chatId);
        console.log('DEBUG: Sending message data to Firestore:', data);
        return ref
          .update({
            messages: firebase.firestore.FieldValue.arrayUnion(data),
          })
          .then(() => {
            if (members) {
              const userDeviceIds = members
                .filter((m) => m?.deviceId?.value)
                .map((m) => m.deviceId.value);
              this.sendGroupPush(chatId, data, userDeviceIds);
            } else if (recipientUid) {
              this.sendPush(chatId, data, recipientUid);
            }
          });
      });
    }
  }

  joinUsers(chat$: Observable<any>) {
    let chat;
    const joinKeys = {};

    return chat$.pipe(
      switchMap((c) => {
        chat = c;
        const uids = Array.from(new Set(c.messages.map((v: any) => v.uid)));

        return runInInjectionContext(this.injector, () => {
          const userDocsByUid = uids.map((uid) =>
            this.afs.doc(`users/${uid}`).valueChanges()
          );
          return userDocsByUid.length ? combineLatest(userDocsByUid) : of([]);
        });
      }),
      map((arr) => {
        arr.forEach((v: any) => {
          if (v) joinKeys[v.uid] = v;
        });
        chat.messages = chat.messages.map((v: any) => {
          return { ...v, user: joinKeys[v.uid] };
        });

        return chat;
      })
    );
  }

  updateChat(chat, count) {
    const userUid = JSON.parse(localStorage.getItem('user'))?.uid;
    const hasRead = chat.hasRead || {};
    hasRead[userUid] = count;

    return runInInjectionContext(this.injector, () => {
      return this.afs.collection('chats').doc(chat.id).update({
        hasRead,
      });
    });
  }

  sendPush(chatId: string | number, data: any, recipientUid: any) {
    if (Capacitor.getPlatform() === 'web') {
      console.log('Skipping push notification on web');
      return;
    }

    this.usersService
      .getUserById(recipientUid)
      .pipe(
        tap((user: any) => {
          if (user?.deviceId?.value) {
            this.http
              .post(
                `https://fcm.googleapis.com/fcm/send`,
                {
                  registration_ids: [user?.deviceId?.value],
                  notification: {
                    body: data?.content,
                    sound: 'default',
                    click_action: 'FCM_PLUGIN_ACTIVITY',
                    icon: 'fcm_push_icon',
                  },
                  data: {
                    landing_page: 'messages/chat',
                    chatId,
                  },
                  priority: 'high',
                  restricted_package_name: '',
                },
                {
                  headers: new HttpHeaders().set(
                    'Authorization',
                    `key=${environment.firebaseConfig.serverKey}`
                  ),
                }
              )
              .subscribe({
                next: () => {},
                error: (err) => console.log('FCM failed:', err),
              });
          }
        })
      )
      .subscribe();
  }

  sendGroupPush(chatId: string | number, data: any, userDeviceIds: string[]) {
    if (Capacitor.getPlatform() === 'web') {
      console.log('Skipping group push notification on web');
      return;
    }

    this.http
      .post(
        `https://fcm.googleapis.com/fcm/send`,
        {
          registration_ids: userDeviceIds,
          notification: {
            body: data?.content,
            sound: 'default',
            click_action: 'FCM_PLUGIN_ACTIVITY',
            icon: 'fcm_push_icon',
          },
          data: {
            landing_page: 'messages/chat',
            chatId,
          },
          priority: 'high',
          restricted_package_name: '',
        },
        {
          headers: new HttpHeaders().set(
            'Authorization',
            `key=${environment.firebaseConfig.serverKey}`
          ),
        }
      )
      .subscribe({
        next: () => {},
        error: (err) => console.log('FCM failed:', err),
      });
  }
}
