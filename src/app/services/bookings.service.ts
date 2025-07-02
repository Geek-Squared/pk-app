import { Injectable, Injector, runInInjectionContext } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { UtilitiesService } from './utilities.service';

@Injectable({
  providedIn: 'root'
})
export class BookingsService {

  constructor(
    private firestore: AngularFirestore,
    public utilsService: UtilitiesService,
    private injector: Injector
  ) {}
  
  submitBooking(booking: any) {
    this.utilsService.presentLoading();
    return runInInjectionContext(this.injector, () => {
      return this.firestore
        .collection('bookings')
        .add(booking)
        .then(() => {
          this.utilsService.dismissLoader();
          this.utilsService.presentToast('Thank you for your booking!');
        })
        .catch((err) => {
          this.utilsService.dismissLoader();
          this.utilsService.presentToast('Error submitting booking!');
        });
    });
  }

}
