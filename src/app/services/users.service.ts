import { Injectable, Injector, runInInjectionContext } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';

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
