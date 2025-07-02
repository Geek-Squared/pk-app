import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthenticationService } from 'src/app/services/authentication.service';
import { UtilitiesService } from 'src/app/services/utilities.service';
import { SplashScreen } from '@ionic-native/splash-screen/ngx';
import { Platform } from '@ionic/angular';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false
})
export class LoginPage implements OnInit {

  subscription: any;
  
  constructor(
    public authService: AuthenticationService,
    private router: Router,
    private utilsService: UtilitiesService,
    private splashScreen: SplashScreen,
    public platform: Platform
  ) {}

  ngOnInit() {
    this.splashScreen.hide();
  }

  ionViewDidEnter(){
    this.subscription = this.platform.backButton.subscribe(() => {
        navigator['app'].exitApp();
    });
  }

  ionViewWillLeave(){
      this.subscription.unsubscribe();
  }

  logIn(email, password) {
   const emailNew = email.value.replace(/\s/g, "");
   this.authService.SignIn(emailNew, password.value);
  }

  logInWithGoogle() {
    this.authService.SignInWithGoogle();
  }
}
