import { Component, OnInit } from '@angular/core';
import { AuthenticationService } from 'src/app/services/authentication.service';
import { UsersService } from 'src/app/services/users.service';
import { NavController } from '@ionic/angular';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: false
})
export class ProfilePage implements OnInit {
  user: any;
  loading = true;

  constructor(
    public authService: AuthenticationService,
    private usersService: UsersService,
    private navCtrl: NavController
  ) {}

  ngOnInit() {
    this.loadUserProfile();
  }

  loadUserProfile() {
    const localUserString = localStorage.getItem('user');
    if (localUserString) {
      const localUser = JSON.parse(localUserString);
      if (localUser && localUser.uid) {
        this.usersService.getUserById(localUser.uid).subscribe(res => {
          this.user = res;
          this.loading = false;
        }, error => {
          console.error('Error loading profile', error);
          this.loading = false;
          // Fallback to local data if firestore fails
          this.user = {
            displayName: localUser.displayName,
            email: localUser.email,
            photoURL: localUser.photoURL
          };
        });
      } else {
        this.loading = false;
      }
    } else {
      this.loading = false;
    }
  }

  get initials() {
    if (!this.user?.displayName) return 'U';
    return this.user.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  logout() {
    this.authService.SignOut();
  }

  goBack() {
    this.navCtrl.back();
  }
}
