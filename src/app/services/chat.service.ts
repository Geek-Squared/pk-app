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
                  if (chat?.type === 'group') {
                    return of(chat);
                  }

                  const recipientUid = chat.uids?.find(uid => uid !== user.uid);
                  if (!recipientUid) return of(chat);
                  
                  return runInInjectionContext(this.injector, () => {
                    return this.afs.doc(`users/${recipientUid}`).valueChanges().pipe(
                      map((u: any) => {
                        const role = typeof u?.role === 'string' ? u.role : null;
                        const profileName = u?.displayName || u?.email || null;
                        return {
                          ...chat,
                          recipientId: recipientUid,
                          recipientOnline: u?.isOnline === true,
                          recipientRole: role,
                          recipientPhoto: u?.photoURL || u?.photoUrl || null,
                          recipientName:
                            profileName ||
                            chat?.recipientName ||
                            'Chat',
                        };
                      })
                    );
                  });
                });

                return combineLatest(joins).pipe(
                  map((joinedChats) => this.sortByLatestActivity(joinedChats))
                );
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
                this.sortByLatestActivity(
                  actions.map((a) => {
                    const data: any = a.payload.doc.data();
                    const id = a.payload.doc.id;
                    return { id, ...data };
                  })
                )
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

  async deleteChat(chatId: string) {
    if (!chatId) return;

    return runInInjectionContext(this.injector, () => {
      return this.afs.collection('chats').doc(chatId).delete();
    });
  }

  async updateGroupMembers(chatId: string, uid: string, memberObj: any) {
    return this.afs.collection('chats').doc(chatId).update({
      uids: firebase.firestore.FieldValue.arrayUnion(uid),
      members: firebase.firestore.FieldValue.arrayUnion(memberObj)
    });
  }

  async acceptCounsellorRequest(chatId: string, counsellorUid: string) {
    if (!chatId) return;
    const now = Date.now();
    const systemMsg = {
      uid: counsellorUid,
      content: 'Session accepted.',
      createdAt: now,
      type: 'system',
    };

    return runInInjectionContext(this.injector, () => {
      const ref = this.afs.collection('chats').doc(chatId);
      return ref.update({
        status: 'active',
        'request.status': 'active',
        'request.acceptedAt': now,
        messages: firebase.firestore.FieldValue.arrayUnion(systemMsg),
      });
    });
  }

  async declineCounsellorRequest(chatId: string, counsellorUid: string) {
    if (!chatId) return;
    const now = Date.now();
    const systemMsg = {
      uid: counsellorUid,
      content: 'Session declined.',
      createdAt: now,
      type: 'system',
    };

    return runInInjectionContext(this.injector, () => {
      const ref = this.afs.collection('chats').doc(chatId);
      return ref.update({
        status: 'declined',
        'request.status': 'declined',
        'request.declinedAt': now,
        messages: firebase.firestore.FieldValue.arrayUnion(systemMsg),
      });
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

  async deleteMessage(chatId: string, msg: any) {
    if (!chatId || !msg) return;

    return runInInjectionContext(this.injector, () => {
      const ref = this.afs.collection('chats').doc(chatId);
      
      return ref.get().toPromise().then(doc => {
        if (doc.exists) {
          const data: any = doc.data();
          const messages = data.messages || [];
          
          // Filter out the message to delete
          // We match by uid and createdAt as a reliable composite key
          const newMessages = messages.filter(m => {
            return !(m.uid === msg.uid && m.createdAt === msg.createdAt);
          });

          return ref.update({ messages: newMessages });
        }
      });
    });
  }

  async reactToMessage(chatId: string, msg: any, emoji: string, userId: string) {
    if (!chatId || !msg || !emoji || !userId) return;

    return runInInjectionContext(this.injector, () => {
      const ref = this.afs.collection('chats').doc(chatId);
      
      return ref.get().toPromise().then(doc => {
        if (doc.exists) {
          const data: any = doc.data();
          const messages = data.messages || [];
          
          const newMessages = messages.map((m: any) => {
            if (m.uid === msg.uid && m.createdAt === msg.createdAt) {
              const reactions = m.reactions || [];
              const existingIndex = reactions.findIndex((r: any) => r.uid === userId && r.emoji === emoji);
              
              if (existingIndex > -1) {
                reactions.splice(existingIndex, 1);
              } else {
                reactions.push({ emoji, uid: userId });
              }
              return { ...m, reactions };
            }
            return m;
          });

          return ref.update({ messages: newMessages });
        }
      });
    });
  }

  private sortByLatestActivity(chats: any[]): any[] {
    return [...(chats || [])].sort(
      (a, b) => this.getLatestActivityAt(b) - this.getLatestActivityAt(a)
    );
  }

  private getLatestActivityAt(chat: any): number {
    const messages = Array.isArray(chat?.messages) ? chat.messages : [];
    const latestMessageAt = messages.reduce((latest: number, message: any) => {
      const createdAt = this.toMillis(message?.createdAt);
      return Math.max(latest, createdAt);
    }, 0);

    return Math.max(
      latestMessageAt,
      this.toMillis(chat?.updatedAt),
      this.toMillis(chat?.createdAt)
    );
  }

  private toMillis(value: any): number {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    if (typeof value?.toMillis === 'function') return value.toMillis();
    if (typeof value?.seconds === 'number') return value.seconds * 1000;
    return 0;
  }
}
