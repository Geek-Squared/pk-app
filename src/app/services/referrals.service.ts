import { Injectable, Injector, runInInjectionContext } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { map } from 'rxjs/operators';
import { Referral } from 'src/app/models/referrals.interface';

@Injectable({
  providedIn: 'root'
})
export class ReferralsService {

  constructor(private firestore: AngularFirestore, private injector: Injector) { }

  getReferralId(referralId: string) {
    return runInInjectionContext(this.injector, () => {
      return this.firestore
        .collection('referrals')
        .doc<Referral>(referralId)
        .snapshotChanges()
        .pipe(
          map((doc: any) => {
            return { id: doc.payload.id, ...doc.payload.data() };
          })
        );
    });
  }

  getReferrals() {
    return runInInjectionContext(this.injector, () => {
      return this.firestore
        .collection<Referral>('referrals', (ref) => ref.orderBy('order'))
        .snapshotChanges();
    });
  }

  getReferralsByReferralId(referralId: string) {
    return runInInjectionContext(this.injector, () => {
      return this.firestore
        .collection<any>('referrals', (ref) =>
          ref.where('referralId', '==', referralId).orderBy('order')
        )
        .snapshotChanges();
    });
  }
}
