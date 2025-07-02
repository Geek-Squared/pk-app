import { Component, OnInit } from '@angular/core';
import { formatDate } from '@angular/common';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthenticationService } from 'src/app/services/authentication.service';
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
    private router: Router
  ) { }

  ngOnInit() {
    this.bookingsForm = this.fb.group({
      fullName: ['', Validators.required],
      phoneNumber: ['', Validators.required],
      email: ['', Validators.required],
      status: ['open', Validators.required],
      bookingDate: ['', Validators.required],
      message: ['', Validators.required],
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

}
