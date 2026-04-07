import { Component, OnInit } from '@angular/core';
import { MenuController, Platform } from '@ionic/angular';
import { AuthenticationService } from 'src/app/services/authentication.service';
import { FcmService } from 'src/app/services/fcm.service';
import { WorkbookService } from 'src/app/services/workbook.service';
import { UsersService } from 'src/app/services/users.service';
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

  constructor(
    public workBooksService: WorkbookService,
    public platform: Platform,
    private authService: AuthenticationService,
    private fcmService: FcmService,
    private menuCtrl: MenuController,
    private usersService: UsersService
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

  ngOnInit() {
    // Trigger the push setup
    this.fcmService.initPush();
    if (!localStorage.getItem('user')) {
      this.authService.saveUser();
    }
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
