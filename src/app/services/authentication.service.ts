import { Injectable, NgZone, Injector, runInInjectionContext } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import {
  AngularFirestore,
  AngularFirestoreDocument,
} from '@angular/fire/compat/firestore';
import { Router } from '@angular/router';
import { UtilitiesService } from './utilities.service';
import { Observable, of } from 'rxjs';
import { switchMap, first } from 'rxjs/operators';
import { FcmService } from './fcm.service';
import { UsersService } from './users.service';
import firebase from 'firebase/compat/app';

@Injectable({
  providedIn: 'root',
})
export class AuthenticationService {
  userData: any; // Save logged in user data
  user$: Observable<any>;

  constructor(
    public afs: AngularFirestore, // Inject Firestore service
    public afAuth: AngularFireAuth, // Inject Firebase auth service
    public router: Router,
    public ngZone: NgZone, // NgZone service to remove outside scope warning,
    public utilsService: UtilitiesService,
    public fcmService: FcmService,
    public usersService: UsersService,
    private injector: Injector
  ) {
    this.saveUser();

    this.user$ = this.afAuth.authState;
  }

  public saveUser() {
    this.afAuth.authState.subscribe((user) => {
      if (user) {
        localStorage.setItem('user', JSON.stringify(user));
        this.userData = user;
        this.router.navigate(['home']);
      } else {
        this.SignOut();
      }
    });
  }

  getUser() {
    return this.user$.pipe(first()).toPromise();
  }

  SignIn(email, password) {
    this.utilsService.presentLoading();
    localStorage.clear();
    return this.afAuth
      .signInWithEmailAndPassword(email, password)
      .then((result) => {
        this.saveUser();
        this.utilsService.dismissLoader();
        if (!result.user.emailVerified) {
          this.utilsService.presentToast('Email not verified!');
        }
      })
      .catch((error) => {
        this.utilsService.dismissLoader();
        this.utilsService.presentToast(error.message);
      });
  }

  SignUp(email, password, displayName) {
    this.utilsService.presentLoading();
    return this.afAuth
      .createUserWithEmailAndPassword(email, password)
      .then((result) => {
        this.SendVerificationMail();
        this.SetUserData(result.user, displayName);
        this.utilsService.dismissLoader();
        this.router.navigate(['/login']);
        this.utilsService.presentToast(
          'Registered successfully. Check your email to verify your account.'
        );
      })
      .catch((error) => {
        this.utilsService.dismissLoader();
        this.utilsService.presentToast(error.message);
      });
  }

  async SendVerificationMail() {
    return (await this.afAuth.currentUser)
      .sendEmailVerification()
      .then(() => {});
  }

  ForgotPassword(passwordResetEmail) {
    return this.afAuth
      .sendPasswordResetEmail(passwordResetEmail)
      .then(() => {
        // window.alert('Password reset email sent, check your inbox.');
        this.utilsService.presentAlert(
          '<ion-icon name="checkmark-done-outline" size="large"></ion-icon> Account successfully reset. Please check your email.'
        );
      })
      .catch((error) => {
        // window.alert(error);
        this.utilsService.presentAlert(
          '<ion-icon name="alert-circle-outline" size="large"></ion-icon> Please enter your email.'
        );
      });
  }

  get isLoggedIn(): boolean {
    let user =
      localStorage.getItem('user') != undefined
        ? JSON?.parse(localStorage.getItem('user'))
        : null;
    return user !== null && user.emailVerified !== false ? true : false;
  }

  AuthLogin(provider) {
    return this.afAuth
      .signInWithPopup(provider)
      .then((result) => {
        this.ngZone.run(() => {
          this.router.navigate(['']);
        });
        this.usersService.getUserById(result.user.uid).subscribe((user) => {
          if (!user) {
            return this.SetUserData(result.user, result.user.uid);
          }
          return;
        });
        this.SetUserData(result.user, result.user.uid);
      })
      .catch((error) => {
        window.alert(error);
      });
  }

  SetUserData(user, displayName) {
    return runInInjectionContext(this.injector, () => {
      const userRef: AngularFirestoreDocument<any> = this.afs.doc(
        `users/${user.uid}`
      );
      const userData: any = {
        uid: user.uid,
        email: user.email,
        displayName: displayName,
        photoURL: user.photoURL,
        emailVerified: user.emailVerified,
      };
      return userRef.set(userData, {
        merge: true,
      });
    });
  }

  // Sign out
  SignOut() {
    this.usersService
      .updateDeviceId(JSON.parse(localStorage.getItem('user'))?.uid, '')
      .then(() =>
        this.afAuth.signOut().then(() => {
          localStorage.clear();
          this.fcmService.unsubscribeFromTopic();

          this.router.navigate(['login']);
        })
      );
  }

  SignInWithGoogle() {
    return this.AuthLogin(new firebase.auth.GoogleAuthProvider());
  }
}
