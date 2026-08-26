import { Component } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import {
  ActionSheetController,
  MenuController,
  NavController,
  Platform,
} from '@ionic/angular';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { AuthenticationService } from './services/authentication.service';
import { TitleService } from './services/title.service';
import { App as CapacitorApp } from '@capacitor/app';
import { UsersService } from './services/users.service';
import { firstValueFrom, Observable, filter, of, switchMap } from 'rxjs';
import { InAppNotificationsService } from './services/in-app-notifications.service';
import { FcmService } from './services/fcm.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  public showBottomNav = true;
  public currentPageTitle = 'Dashboard';
  public user$: Observable<any>;
  public hasUnreadNotifications$ = this.inAppNotifications.hasUnread$;
  private readonly bottomNavHiddenRoutes = ['/home'];
  private readonly authRoutes = [
    '/login',
    '/registration',
    '/reset-password',
    '/verify-email',
  ];
  private pushInitDone = false;
  
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
    '/introduction': 'Introduction',
    '/profile': 'My Profile'
  };

  constructor(
    private platform: Platform,
    public authenticationService: AuthenticationService,
    private menu: MenuController,
    private router: Router,
    private titleService: TitleService,
    private navCtrl: NavController,
    private usersService: UsersService,
    private actionSheetController: ActionSheetController,
    private inAppNotifications: InAppNotificationsService,
    private fcmService: FcmService
  ) {
    this.initializeApp();
    this.watchRouteChanges();

    this.user$ = this.authenticationService.afAuth.authState.pipe(
      switchMap(user => {
        if (user) {
          return this.usersService.getUserById(user.uid);
        } else {
          return of(null);
        }
      })
    );

    // Ensure push + in-app toasts are wired on web/native as soon as user is signed in.
    this.authenticationService.afAuth.authState.subscribe((user) => {
      if (user && !this.pushInitDone) {
        this.pushInitDone = true;
        this.fcmService.initPush();
      }
      if (!user) {
        this.pushInitDone = false;
      }
    });

    this.titleService.title$.subscribe(title => {
      // Defer to the next microtask. A page can emit its title from ngOnInit,
      // which runs inside the same change-detection tick as this shell header.
      // Mutating currentPageTitle synchronously there triggers NG0100
      // (ExpressionChangedAfterItHasBeenCheckedError); deferring lets the
      // change render in a fresh tick instead.
      Promise.resolve().then(() => (this.currentPageTitle = title));
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

    this.showBottomNav = this.authenticationService.isLoggedIn && !this.isImmersiveRoute();
  }

  public isDashboardRoute(): boolean {
    const url = this.router.url.split('?')[0].split('#')[0];
    return url === '/' || url === '/home' || url === '/dashboard' || url === '/profile' || url === '';
  }

  // Routes that take over the full screen (no app header / bottom nav).
  public isImmersiveRoute(): boolean {
    const url = this.router.url.split('?')[0].split('#')[0];
    const trimmed = url !== '/' && url.endsWith('/') ? url.slice(0, -1) : url;
    return (
      // Auth screens, by route rather than by session state. isLoggedIn reads
      // localStorage, which outlives the session — so a stale entry was drawing
      // the app header over the login page, offering a menu and a chat button
      // to someone who is not signed in.
      this.authRoutes.some((r) => trimmed === r || trimmed.startsWith(r + '/')) ||
      trimmed === '/ai-assistant' ||
      trimmed.startsWith('/ai-assistant/') ||
      trimmed.startsWith('/messages/chat/') ||
      trimmed === '/how-to-use' ||
      // Onboarding owns the whole screen. It runs before the member has an app
      // to navigate, so a nav bar and a menu button would offer them exits to
      // places that are not ready for them yet.
      trimmed === '/onboarding' ||
      trimmed.startsWith('/onboarding/')
    );
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
      await StatusBar.setStyle({ style: Style.Light });
    } catch (error) {
      console.warn('Unable to configure native status bar overlay', error);
    }
  }

  public async openChatLauncher(): Promise<void> {
    // If we have an unread chat notification, jump to it first.
    const last = await firstValueFrom(this.inAppNotifications.last$);

    if (last?.targetUrl) {
      this.inAppNotifications.clearUnread();
      this.router.navigateByUrl(last.targetUrl);
      return;
    }

    const currentUser = await firstValueFrom(this.user$);
    const isCounsellor = `${currentUser?.role ?? ''}`.toLowerCase() === 'counsellor';

    const buttons: any[] = [];

    if (!isCounsellor) {
      buttons.push({
        text: 'Chat with Counsellor',
        icon: 'chatbubbles-outline',
        handler: () => this.router.navigateByUrl('/messages/counsellors'),
      });
    }

    buttons.push(
      {
        text: 'Chat with Community',
        icon: 'people-outline',
        handler: () => this.router.navigateByUrl('/messages'),
      },
      {
        text: 'Chat with Peekay',
        icon: 'sparkles-outline',
        handler: () => this.router.navigateByUrl('/ai-assistant'),
      },
      {
        text: 'Cancel',
        role: 'cancel',
        icon: 'close-outline',
      }
    );

    const sheet = await this.actionSheetController.create({
      header: 'Chat',
      buttons,
    });

    await sheet.present();
  }
}
