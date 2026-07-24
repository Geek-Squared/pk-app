import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthenticationService } from 'src/app/services/authentication.service';
import { UtilitiesService } from 'src/app/services/utilities.service';

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
    private utils: UtilitiesService
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
    // Account provisioning (user doc, workbook, private chat) is handled
    // server-side by the processSignUp onCreate Cloud Function, so it can't be
    // lost if the app is backgrounded/offline right after sign-up.
    this.authService
      .SignUp(email.value, password.value, displayName.value, consent)
      .catch((error) => {
        this.utils.presentToast(error.message);
      });
  }
}
