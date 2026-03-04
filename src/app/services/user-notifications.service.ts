import { Injectable, Injector, runInInjectionContext } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';

@Injectable({
  providedIn: 'root',
})
export class UserNotificationsService {
  constructor(private afs: AngularFirestore, private injector: Injector) {}

  getUserNotifications(uid: string) {
    return runInInjectionContext(this.injector, () => {
      return this.afs
        .collection('users')
        .doc(uid)
        .collection('notifications', (ref) => ref.orderBy('createdAt', 'desc'))
        .valueChanges({ idField: 'id' });
    });
  }

  markAsRead(uid: string, notificationId: string) {
    if (!uid || !notificationId) {
      return Promise.resolve();
    }
    return runInInjectionContext(this.injector, () => {
      return this.afs
        .collection('users')
        .doc(uid)
        .collection('notifications')
        .doc(notificationId)
        .set(
          {
            read: true,
            readAt: Date.now(),
          },
          { merge: true }
        );
    });
  }
}
