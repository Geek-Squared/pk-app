import { formatDate } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthenticationService } from 'src/app/services/authentication.service';
import { FeedbackService } from 'src/app/services/feedback.service';

@Component({
  selector: 'app-feedback',
  templateUrl: './feedback.page.html',
  styleUrls: ['./feedback.page.scss'],
  standalone: false
})
export class FeedbackPage implements OnInit {
  public feedbackForm: UntypedFormGroup;

  constructor(
    private feedbackService: FeedbackService,
    private fb: UntypedFormBuilder,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.feedbackForm = this.fb.group({
      name: '',
      phoneNumber: '',
      message: ['', Validators.required],
    });
  }

  onSubmit() {
    let feedback = this.feedbackForm.value;
    feedback.createdDate = formatDate(new Date(), 'yyyy-MM-dd', 'en-US');
    this.feedbackService.addFeedback(feedback).then(
      () => {
        this.router.navigate(['']);
      },
      () => {}
    );
  }
}
