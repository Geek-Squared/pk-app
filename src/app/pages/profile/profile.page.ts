import { Component, OnInit } from '@angular/core';
import { AuthenticationService } from 'src/app/services/authentication.service';
import { UsersService } from 'src/app/services/users.service';
import { NavController, ToastController, AlertController } from '@ionic/angular';
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
  editing = false;
  editData: any = {
    displayName: ''
  };

  constructor(
    public authService: AuthenticationService,
    private usersService: UsersService,
    private navCtrl: NavController,
    private fileStorage: FileStorageService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController
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

  get userRole() {
    if (this.user?.role) {
      if (typeof this.user.role === 'object' && this.user.role.name) {
        return this.user.role.name;
      }
      return this.user.role;
    }
    return 'Wellness Member';
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

  toggleEditing() {
    this.editing = !this.editing;
    if (this.editing) {
      this.editData.displayName = this.user?.displayName || '';
    }
  }

  async saveProfile() {
    if (!this.editData.displayName.trim()) {
      const toast = await this.toastCtrl.create({
        message: 'Name cannot be empty.',
        duration: 2000,
        color: 'warning'
      });
      toast.present();
      return;
    }

    this.loading = true;
    try {
      await this.authService.UpdateProfile(this.editData.displayName);
      this.user.displayName = this.editData.displayName;
      
      // Update local storage
      const localUser = JSON.parse(localStorage.getItem('user'));
      localUser.displayName = this.editData.displayName;
      localStorage.setItem('user', JSON.stringify(localUser));

      this.editing = false;
      const toast = await this.toastCtrl.create({
        message: 'Profile updated successfully!',
        duration: 2000,
        color: 'success'
      });
      toast.present();
    } catch (error) {
      console.error('Error updating profile', error);
      const toast = await this.toastCtrl.create({
        message: 'Error updating profile. Please try again.',
        duration: 2000,
        color: 'danger'
      });
      toast.present();
    } finally {
      this.loading = false;
    }
  }

  async confirmDelete() {
    const alert = await this.alertCtrl.create({
      header: 'Delete Account?',
      message: 'This action is permanent and cannot be undone. All your data will be removed.',
      cssClass: 'delete-confirm-alert',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          cssClass: 'secondary'
        },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => {
            this.deleteAccount();
          }
        }
      ]
    });

    await alert.present();
  }

  async deleteAccount() {
    this.loading = true;
    try {
      await this.authService.DeleteAccount();
    } catch (error: any) {
      console.error('Error deleting account', error);
      let message = 'Error deleting account. Please try again.';
      if (error.code === 'auth/requires-recent-login') {
        message = 'For security reasons, please logout and log back in before deleting your account.';
      }
      const toast = await this.toastCtrl.create({
        message: message,
        duration: 5000,
        color: 'danger'
      });
      toast.present();
    } finally {
      this.loading = false;
    }
  }

  logout() {
    this.authService.SignOut();
  }

  goBack() {
    this.navCtrl.back();
  }
}
