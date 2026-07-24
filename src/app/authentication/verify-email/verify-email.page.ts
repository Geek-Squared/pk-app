import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AuthenticationService } from 'src/app/services/authentication.service';
import { UtilitiesService } from 'src/app/services/utilities.service';

@Component({
  selector: 'app-verify-email',
  templateUrl: './verify-email.page.html',
  styleUrls: ['./verify-email.page.scss'],
  standalone: false,
})
export class VerifyEmailPage implements OnInit, OnDestroy {
  public email = '';
  public resendCooldown = 0;
  public checking = false;
  private cooldownTimer: any;

  constructor(
    private afAuth: AngularFireAuth,
    private authService: AuthenticationService,
    private utils: UtilitiesService,
    private router: Router
  ) {}

  async ngOnInit() {
    const user = await this.afAuth.currentUser;
    if (!user) {
      // Page opened without an active session — nothing to verify here.
      this.router.navigate(['login']);
      return;
    }
    this.email = user.email || '';
    if (user.emailVerified) {
      this.proceed();
    }
  }

  ngOnDestroy() {
    if (this.cooldownTimer) {
      clearInterval(this.cooldownTimer);
    }
  }

  async resend() {
    if (this.resendCooldown > 0) {
      return;
    }
    try {
      await this.authService.SendVerificationMail();
      this.utils.presentToast(
        'Verification email sent. Check your inbox (and spam).'
      );
      this.startCooldown(60);
    } catch (error: any) {
      this.utils.presentToast(
        error?.message || 'Could not send email. Please try again shortly.'
      );
    }
  }

  async checkVerified() {
    this.checking = true;
    try {
      const user = await this.afAuth.currentUser;
      if (!user) {
        this.router.navigate(['login']);
        return;
      }
      // Pull the latest state from Firebase rather than trusting the cached flag.
      await user.reload();
      const refreshed = await this.afAuth.currentUser;
      if (refreshed && refreshed.emailVerified) {
        this.proceed();
      } else {
        this.utils.presentToast(
          'Not verified yet. Please open the link in your email first.'
        );
      }
    } catch (error: any) {
      this.utils.presentToast(
        error?.message || 'Could not check status. Please try again.'
      );
    } finally {
      this.checking = false;
    }
  }

  backToLogin() {
    // SignOut clears the session and routes to /login.
    this.authService.SignOut();
  }

  private proceed() {
    this.utils.presentToast('Email verified! Welcome.');
    this.router.navigate(['home']);
  }

  private startCooldown(seconds: number) {
    this.resendCooldown = seconds;
    this.cooldownTimer = setInterval(() => {
      this.resendCooldown--;
      if (this.resendCooldown <= 0) {
        clearInterval(this.cooldownTimer);
        this.cooldownTimer = null;
      }
    }, 1000);
  }
}
