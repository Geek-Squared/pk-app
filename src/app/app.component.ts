import { Component } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
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
  public showBottomNav = true;
  private readonly bottomNavHiddenRoutes = ['/home'];

  constructor(
    private platform: Platform,
    public authenticationService: AuthenticationService,
    private menu: MenuController,
    private router: Router
  ) {
    this.initializeApp();
    this.watchRouteChanges();
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

  private watchRouteChanges(): void {
    this.updateBottomNavVisibility(this.router.url);

    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.updateBottomNavVisibility(event.urlAfterRedirects);
      }
    });
  }

  private updateBottomNavVisibility(url: string): void {
    const normalizedUrl = (url.split('?')[0] || '/').split('#')[0];
    const trimmedUrl =
      normalizedUrl !== '/' && normalizedUrl.endsWith('/')
        ? normalizedUrl.slice(0, -1)
        : normalizedUrl;

    const shouldHideOnHome = this.bottomNavHiddenRoutes.includes(trimmedUrl);
    const shouldHideOnRoot = trimmedUrl === '/' || trimmedUrl === '';

    this.showBottomNav = !(shouldHideOnHome || shouldHideOnRoot);
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
