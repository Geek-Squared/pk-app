import { Injectable, Injector, runInInjectionContext } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Router } from '@angular/router';

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
        return runInInjectionContext(this.injector, () => {
          return this.afs
            .collection('chats', (ref) => ref.where('uid', '==', user.uid))
            .snapshotChanges()
            .pipe(
              map((actions) => {
                return actions.map((a) => {
                  const data: Object = a.payload.doc.data();
                  const id = a.payload.doc.id;
                  return { id, ...data };
                });
              })
            );
        });
      })
    );
  }

  getGroupChats() {
    return this.auth.user$.pipe(
      switchMap(() => {
        return runInInjectionContext(this.injector, () => {
          return this.afs
            .collection('chats', (ref) => ref.where('type', '==', 'group'))
            .snapshotChanges()
            .pipe(
              map((actions) => {
                return actions.map((a) => {
                  const data: Object = a.payload.doc.data();
                  const id = a.payload.doc.id;
                  return { id, ...data };
                });
              })
            );
        });
      })
    );
  }

  async create() {
    const { uid, displayName } = await this.auth.getUser();

    const data = {
      uid,
      displayName,
      createdAt: Date.now(),
      count: 0,
      messages: [],
    };

    const docRef = await runInInjectionContext(this.injector, () => {
      return this.afs.collection('chats').add(data);
    });

    return this.router.navigate(['messages/chat', docRef.id]);
  }

  async sendMessage(
    chatId: string,
    content: string,
    chatUser?: string,
    members?: Member[],
    type: string = 'text'
  ) {
    const { uid } = await this.auth.getUser();

    if (!uid) return;

    const data = {
      uid,
      content,
      createdAt: Date.now(),
      type,
    };

    if (members) {
      let uniqueItems = [...new Set(members.map((el) => el?.deviceId?.value))];
      this.sendGroupPush(chatId, data, uniqueItems);
    } else if (chatUser && chatUser !== uid) {
      this.sendPush(chatId, data, chatUser);
    }

    return runInInjectionContext(this.injector, () => {
      const ref = this.afs.collection('chats').doc(chatId);
      return ref
        .update({
          messages: firebase.firestore.FieldValue.arrayUnion(data),
        })
        .then((res) => {});
    });
  }

  joinUsers(chat$: Observable<any>) {
    let chat;
    const joinKeys = {};

    return chat$.pipe(
      switchMap((c) => {
        // Unique User IDs
        chat = c;
        const uids = Array.from(new Set(c.messages.map((v) => v?.uid)));

        // Firestore User Doc Reads
        const userDocs = uids.map((u) =>
          runInInjectionContext(this.injector, () => {
            return this.afs.doc(`users/${u}`).valueChanges();
          })
        );

        return userDocs.length ? combineLatest(userDocs) : of([]);
      }),
      map((arr) => {
        arr.forEach((v) => (joinKeys[(<any>v)?.uid] = v));
        chat.messages = chat.messages.map((v) => {
          return { ...v, user: joinKeys[v?.uid] };
        });

        return chat;
      })
    );
  }

  async updateChat(chat, totalRead) {
    const user = await this.auth.getUser();

    if (!user?.uid) return;

    return runInInjectionContext(this.injector, () => {
      const chatRef = this.afs.collection('chats').doc(chat.id);
      return chatRef.update({ [`hasRead.${user.uid}`]: totalRead });
    });
  }

  sendPush(chatId: string | number, data: any, uid: string) {
    this.usersService
      .getUserById(uid)
      .pipe(
        tap((user: any) => {
          if (user.deviceId) {
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
                  /*  to: user?.deviceId.value, */
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
              .subscribe();
          }
        })
      )
      .subscribe();
  }

  sendGroupPush(chatId: string | number, data: any, userDeviceIds: string[]) {
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
          /*  to: user?.deviceId.value, */
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
      .subscribe();
  }
}
