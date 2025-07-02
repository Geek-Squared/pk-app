import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthenticationService } from 'src/app/services/authentication.service';
import { UtilitiesService } from 'src/app/services/utilities.service';
import { Platform } from '@ionic/angular';

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.page.html',
  styleUrls: ['./reset-password.page.scss'],
})
export class ResetPasswordPage implements OnInit {

  constructor(
    public authService: AuthenticationService,
    private router: Router,
    private utilsService: UtilitiesService,
    public platform: Platform
  ) {}

  ngOnInit() {
  }

  resetPassword(email) {
   const emailNew = email.value.replace(/\s/g, "");
   this.authService.ForgotPassword(emailNew);
  }

}
