import { Component } from '@angular/core';
import { MenuController, Platform } from '@ionic/angular';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { AuthenticationService } from './services/authentication.service';
import { App as CapacitorApp } from '@capacitor/app';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  constructor(
    private platform: Platform,
    private authenticationService: AuthenticationService,
    private menu: MenuController
  ) {
    this.initializeApp();
    CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (!canGoBack) {
        CapacitorApp.exitApp();
      } else {
        window.history.back();
      }
    });
  }

  initializeApp() {
    this.platform.ready().then(() => {
      this.configureStatusBar();
      setTimeout(() => {
        SplashScreen.hide({
          fadeOutDuration: 500,
        }).catch(() => undefined);
      }, 1000);
    });
  }

  logOut() {
    this.authenticationService.SignOut();
    this.menu.close();
  }

  private async configureStatusBar(): Promise<void> {
    if (!(this.platform.is('android') || this.platform.is('ios'))) {
      return;
    }

    try {
      await StatusBar.setOverlaysWebView({ overlay: false });
      if (this.platform.is('android')) {
        await StatusBar.setBackgroundColor({ color: '#ffffff' });
      }
      await StatusBar.setStyle({ style: Style.Dark });
    } catch (error) {
      console.warn('Unable to configure native status bar overlay', error);
    }
  }
}
