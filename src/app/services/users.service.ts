import { Injectable, Injector, runInInjectionContext } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import firebase from 'firebase/compat/app';

@Injectable({
  providedIn: 'root',
})
export class UsersService {
  constructor(private firestore: AngularFirestore, private injector: Injector) {}

  updateDeviceId(userId: string, deviceId: string) {
    if (!userId) {
      return Promise.resolve();
    }

    return runInInjectionContext(this.injector, () => {
      return this.firestore
        .collection('users')
        .doc(userId)
        .set(
          {
            deviceId: typeof deviceId === 'string' ? { value: deviceId } : deviceId,
            deviceIdUpdatedAt: Date.now(),
          },
          { merge: true }
        );
    });
  }

  updateUser(userId: string, data: any) {
    return runInInjectionContext(this.injector, () => {
      return this.firestore
        .collection('users')
        .doc(userId)
        .update(data);
    });
  }

  updateWebFcmToken(userId: string, token: string) {
    if (!userId || !token) {
      return Promise.resolve();
    }
    return runInInjectionContext(this.injector, () => {
      return this.firestore
        .collection('users')
        .doc(userId)
        .set(
          {
            webFcmTokens: firebase.firestore.FieldValue.arrayUnion(token),
            webFcmTokensUpdatedAt: Date.now(),
          },
          { merge: true }
        );
    });
  }

  updateOnlineStatus(userId: string, isOnline: boolean) {
    if (!userId) {
      return Promise.resolve();
    }

    return runInInjectionContext(this.injector, () => {
      return this.firestore
        .collection('users')
        .doc(userId)
        .set(
          {
            isOnline,
            lastSeenAt: Date.now(),
          },
          { merge: true }
        );
    });
  }

  blockUser(userId: string, blockedUid: string) {
    if (!userId || !blockedUid) {
      return Promise.resolve();
    }

    return runInInjectionContext(this.injector, () => {
      return this.firestore
        .collection('users')
        .doc(userId)
        .set(
          {
            blockedUids: firebase.firestore.FieldValue.arrayUnion(blockedUid),
            blockedUpdatedAt: Date.now(),
          },
          { merge: true }
        );
    });
  }

  unblockUser(userId: string, blockedUid: string) {
    if (!userId || !blockedUid) {
      return Promise.resolve();
    }

    return runInInjectionContext(this.injector, () => {
      return this.firestore
        .collection('users')
        .doc(userId)
        .set(
          {
            blockedUids: firebase.firestore.FieldValue.arrayRemove(blockedUid),
            blockedUpdatedAt: Date.now(),
          },
          { merge: true }
        );
    });
  }


  getUserById(userId: string) {
    return runInInjectionContext(this.injector, () => {
      return this.firestore.collection('users').doc(userId).valueChanges();
    });
  }

  getUsers() {
    return runInInjectionContext(this.injector, () => {
      return this.firestore.collection('users').snapshotChanges();
    });
  }

  deleteUser(userId: string) {
    return runInInjectionContext(this.injector, () => {
      return this.firestore.collection('users').doc(userId).delete();
    });
  }
}
