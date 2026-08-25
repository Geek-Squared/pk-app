import { Injectable } from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { AuthenticationService } from '../services/authentication.service';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard {
  constructor(private router: Router, private auth: AuthenticationService) {}

  canActivate(): Observable<boolean | UrlTree> {
    // Gate on the live Firebase session (fresh, and not user-editable) rather
    // than the localStorage snapshot, which can go stale or be tampered with.
    // take(1) waits for auth persistence to be restored, then settles.
    return this.auth.afAuth.authState.pipe(
      take(1),
      map((user) => {
        if (user && user.emailVerified) {
          // Keep the localStorage snapshot the rest of the app reads in sync.
          localStorage.setItem('user', JSON.stringify(user));
          return true;
        }
        if (user && !user.emailVerified) {
          return this.router.parseUrl('/verify-email');
        }
        return this.router.parseUrl('/login');
      })
    );
  }
}
