import { Injectable, Injector, runInInjectionContext } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import firebase from 'firebase/compat/app';

@Injectable({
  providedIn: 'root',
})
export class UsersService {
  constructor(private firestore: AngularFirestore, private injector: Injector) {}

  updateDeviceId(userId: string, deviceId: string) {
    return runInInjectionContext(this.injector, () => {
      return this.firestore
        .collection('users')
        .doc(userId)
        .update({ deviceId: deviceId });
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
}
