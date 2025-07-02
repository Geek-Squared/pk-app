import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthenticationService } from 'src/app/services/authentication.service';
import { ChatService } from 'src/app/services/chat.service';
import { UtilitiesService } from 'src/app/services/utilities.service';
import { WorkbookService } from 'src/app/services/workbook.service';

@Component({
  selector: 'app-registration',
  templateUrl: './registration.page.html',
  styleUrls: ['./registration.page.scss'],
  standalone: false
})
export class RegistrationPage implements OnInit {
  constructor(
    public authService: AuthenticationService,
    public router: Router,
    public workBooksService: WorkbookService,
    private utils: UtilitiesService,
    private chatService: ChatService
  ) {}

  ngOnInit() {}

  signUp(email, password, displayName) {
    this.authService
      .SignUp(email.value, password.value, displayName.value)
      .then(() => {})
      .catch((error) => {
        this.utils.presentToast(error.message);
      })
      .then(() => {
        this.workBooksService.create();
        this.chatService.create();
      });
  }
}
