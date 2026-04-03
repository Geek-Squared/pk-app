import { Component, OnInit } from '@angular/core';
import { AuthenticationService } from 'src/app/services/authentication.service';
import { UsersService } from 'src/app/services/users.service';
import { NavController, ToastController } from '@ionic/angular';
import { FileStorageService } from 'src/app/services/file-storage.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: false
})
export class ProfilePage implements OnInit {
  user: any;
  loading = true;
  uploading = false;

  constructor(
    public authService: AuthenticationService,
    private usersService: UsersService,
    private navCtrl: NavController,
    private fileStorage: FileStorageService,
    private toastCtrl: ToastController
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

  async onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.uploadPhoto(file);
    }
  }

  async uploadPhoto(file: File) {
    const toast = await this.toastCtrl.create({
      message: 'Uploading profile picture...',
      duration: 2000
    });
    toast.present();
    this.uploading = true;

    try {
      const downloadUrl = await this.fileStorage.uploadImage(file);
      const uid = this.user.uid;
      
      // Update Firestore
      await this.usersService.updateUser(uid, { photoURL: downloadUrl });
      
      // Update local object for immediate UI feedback
      this.user.photoURL = downloadUrl;
      
      // Update local storage too to keep it in sync
      const localUser = JSON.parse(localStorage.getItem('user'));
      localUser.photoURL = downloadUrl;
      localStorage.setItem('user', JSON.stringify(localUser));

      const successToast = await this.toastCtrl.create({
        message: 'Profile picture updated successfully!',
        duration: 3000,
        color: 'success'
      });
      successToast.present();
    } catch (error) {
      console.error('Error uploading photo', error);
      const errorToast = await this.toastCtrl.create({
        message: 'Failed to upload profile picture. Please try again.',
        duration: 3000,
        color: 'danger'
      });
      errorToast.present();
    } finally {
      this.uploading = false;
    }
  }

  logout() {
    this.authService.SignOut();
  }

  goBack() {
    this.navCtrl.back();
  }
}
