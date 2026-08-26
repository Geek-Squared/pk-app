import { Component, OnInit } from '@angular/core';
import { formatDate } from '@angular/common';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { BookingsService } from 'src/app/services/bookings.service';

@Component({
  selector: 'app-bookings',
  templateUrl: './bookings.page.html',
  styleUrls: ['./bookings.page.scss'],
  standalone: false
})
export class BookingsPage implements OnInit {
  public bookingsForm: UntypedFormGroup;

  constructor(
    private bookingsService: BookingsService,
    private fb: UntypedFormBuilder,
    private alertCtrl: AlertController,
    private fns: AngularFireFunctions,
    private router: Router
  ) { }

  ngOnInit() {
    this.bookingsForm = this.fb.group({
      fullName: ['', Validators.required],
      phoneNumber: ['', Validators.required],
      email: ['', Validators.required],
      status: ['open', Validators.required],
      bookingDate: ['', Validators.required],
      // The message is genuinely optional now. The form claimed "all fields are
      // required" and enforced it, so someone who did not want to explain
      // themselves in writing could not book a session at all.
      message: [''],
    });
  }

  onSubmit() {
    let booking = this.bookingsForm.value;
    booking.createdDate = formatDate(new Date(), 'yyyy-MM-dd', 'en-US');

    this.bookingsService.submitBooking(booking).then(
      () => {
        this.router.navigate(['/bookings']);
        this.bookingsForm.reset();
      },
      () => {}
    );
  }

  /**
   * The same route to a person that onboarding offers. Someone booking a
   * counselling session may not be able to wait for a confirmation, and every
   * other support surface in the app gives them a way through — this one did
   * not.
   */
  async talkToSomeone(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Talk to a counsellor',
      message:
        'You can speak to a counsellor now. You do not need to book a session first.',
      buttons: [
        { text: 'Not now', role: 'cancel' },
        {
          text: 'Connect me',
          handler: async () => {
            try {
              await this.fns.httpsCallable('requestCounsellorChat')({}).toPromise();
            } catch (error) {
              console.error('Could not request a counsellor', error);
            }
            this.router.navigateByUrl('/messages');
          },
        },
      ],
    });
    await alert.present();
  }
}
