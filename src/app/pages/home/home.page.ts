import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MenuController, Platform } from '@ionic/angular';
import { AuthenticationService } from 'src/app/services/authentication.service';
import { HOW_TO_SEEN_KEY } from 'src/app/pages/how-to-use/how-to-use.page';
import { FcmService } from 'src/app/services/fcm.service';
import { WorkbookService } from 'src/app/services/workbook.service';
import { UsersService } from 'src/app/services/users.service';
import { ShareService } from 'src/app/services/share.service';
import { Observable, of, switchMap } from 'rxjs';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: false
})
export class HomePage implements OnInit {
  subscription: any;
  user$: Observable<any>;
  hasInterventionProgress = false;

  constructor(
    public workBooksService: WorkbookService,
    public platform: Platform,
    private authService: AuthenticationService,
    private fcmService: FcmService,
    private menuCtrl: MenuController,
    private usersService: UsersService,
    private router: Router,
    private shareService: ShareService
  ) {
    this.user$ = this.authService.afAuth.authState.pipe(
      switchMap(user => {
        if (user) {
          return this.usersService.getUserById(user.uid);
        } else {
          return of(null);
        }
      })
    );
  }

  /**
   * The button lives inside the card's routerLink, so without stopping the
   * event the tap would navigate to /referrals instead of opening the sheet.
   */
  async shareApp(event: Event): Promise<void> {
    event.stopPropagation();
    event.preventDefault();
    await this.shareService.shareApp();
  }

  ngOnInit() {
    // First-launch walkthrough: show the "How to use PK" guide once.
    if (!localStorage.getItem(HOW_TO_SEEN_KEY)) {
      this.router.navigateByUrl('/how-to-use');
      return;
    }

    // Trigger the push setup
    this.fcmService.initPush();
    if (!localStorage.getItem('user')) {
      this.authService.saveUser();
    }

    this.checkInterventionProgress();

    this.authService.afAuth.authState.subscribe((authUser) => {
    });

    this.user$.subscribe((userDoc) => {
    });
  }

  ionViewDidEnter() {
    this.subscription = this.platform.backButton.subscribe(() => {
      navigator['app'].exitApp();
    });
  }

  ionViewWillLeave() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  ionViewWillEnter() {
    if (!localStorage.getItem('userWorkbookId')) {
      this.saveWorkBookId();
    }
    // Refresh progress when returning to home (e.g. after an intervention session)
    this.checkInterventionProgress();
  }

  private checkInterventionProgress() {
    this.workBooksService.getUserQuestionResponses().subscribe(
      (res: any) => {
        const responses = res?.[0]?.responses ?? [];
        this.hasInterventionProgress = responses.some((r: any) =>
          this.isMeaningfulResponse(r)
        );
      },
      () => undefined
    );
  }

  private isMeaningfulResponse(response: any): boolean {
    if (!response) {
      return false;
    }
    if (typeof response.qualityScore === 'number') {
      return response.qualityScore >= 5;
    }
    const content = response?.content;
    const text = (typeof content === 'string' ? content : JSON.stringify(content ?? ''))
      .replace(/[\n\r]/g, ' ')
      .trim()
      .toLowerCase();
    if (!text || text === '""') {
      return false;
    }
    const banned = ['x', 'n/a', 'na', 'none', 'nil'];
    return !banned.includes(text);
  }

  private saveWorkBookId() {
    this.workBooksService.getUserWorkbook().subscribe((res: any) => {
      if (res[0]?.id) {
        localStorage.setItem('userWorkbookId', res[0].id);
      } else {
        this.createNewWorkbook();
      }
    });
  }

  createNewWorkbook() {
    this.workBooksService.create().then(() => this.saveWorkBookId());
  }

  openMenu() {
    this.menuCtrl.open();
  }
}
