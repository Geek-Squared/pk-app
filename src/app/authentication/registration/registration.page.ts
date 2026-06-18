import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthenticationService } from 'src/app/services/authentication.service';
import { ChatService } from 'src/app/services/chat.service';
import { UtilitiesService } from 'src/app/services/utilities.service';
import { WorkbookService } from 'src/app/services/workbook.service';

@Component({
  selector: 'app-registration',
  templateUrl: './registration.page.html',
  styleUrls: ['./registration.page.scss'],
  standalone: false
})
export class RegistrationPage implements OnInit {
  // Explicit consent to the Terms & Privacy Policy is required before sign-up.
  public agreedToTerms = false;
  // Bump this when the Terms / Privacy Policy materially change.
  private readonly CONSENT_VERSION = '1.0';

  constructor(
    public authService: AuthenticationService,
    public router: Router,
    public workBooksService: WorkbookService,
    private utils: UtilitiesService,
    private chatService: ChatService
  ) {}

  ngOnInit() {}

  signUp(email, password, displayName) {
    if (!this.agreedToTerms) {
      this.utils.presentToast(
        'Please agree to the Terms & Conditions and Privacy Policy to continue.'
      );
      return;
    }
    const consent = {
      agreed: true,
      version: this.CONSENT_VERSION,
      acceptedAt: Date.now(),
    };
    this.authService
      .SignUp(email.value, password.value, displayName.value, consent)
      .then(() => {})
      .catch((error) => {
        this.utils.presentToast(error.message);
      })
      .then(() => {
        this.workBooksService.create();
        this.chatService.create();
      });
  }
}
