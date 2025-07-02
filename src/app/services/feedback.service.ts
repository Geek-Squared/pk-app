import { Injectable, Injector, runInInjectionContext } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { UtilitiesService } from './utilities.service';

@Injectable({
  providedIn: 'root',
})
export class FeedbackService {
  constructor(
    private firestore: AngularFirestore,
    public utilsService: UtilitiesService,
    private injector: Injector
  ) {}

  addFeedback(feedback: any) {
    this.utilsService.presentLoading();
    return runInInjectionContext(this.injector, () => {
      return this.firestore
        .collection('feedback')
        .add(feedback)
        .then(() => {
          this.utilsService.dismissLoader();
          this.utilsService.presentToast('Thank you for your feedback');
        })
        .catch((err) => {
          this.utilsService.dismissLoader();
        });
    });
  }
}
