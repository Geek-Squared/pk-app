import { Component } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { MenuController, NavController, Platform } from '@ionic/angular';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { AuthenticationService } from './services/authentication.service';
import { TitleService } from './services/title.service';
import { App as CapacitorApp } from '@capacitor/app';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  public showBottomNav = true;
  public currentPageTitle = 'Dashboard';
  private readonly bottomNavHiddenRoutes = ['/home'];
  
  private routeTitleMap: { [key: string]: string } = {
    '/': 'Dashboard',
    '/home': 'Dashboard',
    '/dashboard': 'Dashboard',
    '/messages': 'Messages',
    '/about': 'About',
    '/interventions': 'Interventions',
    '/my-work-book': 'My Workbook',
    '/ai-assistant': 'Wellness Chat',
    '/feedback': 'Feedback',
    '/referrals': 'Referrals',
    '/bookings': 'Bookings',
    '/surveys': 'Surveys',
    '/introduction': 'Introduction'
  };

  constructor(
    private platform: Platform,
    public authenticationService: AuthenticationService,
    private menu: MenuController,
    private router: Router,
    private titleService: TitleService,
    private navCtrl: NavController
  ) {
    this.initializeApp();
    this.watchRouteChanges();
    this.titleService.title$.subscribe(title => {
      this.currentPageTitle = title;
    });
    CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (!canGoBack) {
        CapacitorApp.exitApp();
      } else {
        this.navCtrl.back();
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

  navigateBack() {
    this.navCtrl.back();
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

    // Detect chat details and other dynamic routes
    if (trimmedUrl.startsWith('/messages/chat/')) {
      // Don't override title here, let ChatComponent do it via TitleService
    } else if (normalizedUrl.includes('/posts/')) {
      this.titleService.setTitle('Stories');
    } else if (normalizedUrl.includes('/questions/')) {
      this.titleService.setTitle('Questions');
    } else {
      this.titleService.setTitle(this.routeTitleMap[trimmedUrl] || 'Dashboard');
    }

    const shouldHideOnHome = this.bottomNavHiddenRoutes.includes(trimmedUrl);
    const shouldHideOnRoot = trimmedUrl === '/' || trimmedUrl === '';

    this.showBottomNav = !(shouldHideOnHome || shouldHideOnRoot);
  }

  public isDashboardRoute(): boolean {
    const url = this.router.url.split('?')[0].split('#')[0];
    return url === '/' || url === '/home' || url === '/dashboard' || url === '';
  }

  private async configureStatusBar(): Promise<void> {
    if (!(this.platform.is('android') || this.platform.is('ios'))) {
      return;
    }

    try {
      await StatusBar.setOverlaysWebView({ overlay: false });
      if (this.platform.is('android')) {
        await StatusBar.setBackgroundColor({ color: '#0f63ff' });
      }
      await StatusBar.setStyle({ style: Style.Light });
    } catch (error) {
      console.warn('Unable to configure native status bar overlay', error);
    }
  }
}
