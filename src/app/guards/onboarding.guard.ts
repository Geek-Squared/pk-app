import { Injectable, Injector, runInInjectionContext } from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Observable, of, combineLatest } from 'rxjs';
import { map, switchMap, take, catchError } from 'rxjs/operators';

/**
 * Sends new members through onboarding before they reach the app.
 *
 * Runs after AuthGuard, and reads `users/{uid}.onboardingStatus` rather than
 * the intake document — the guard costs one read of a document the app already
 * fetches, and learns nothing sensitive.
 *
 * The branch that matters most is the third: an existing member who joined
 * before onboarding existed must never be locked out of years of their own
 * progress by a form they have not filled in. They get invited, not blocked.
 */
@Injectable({ providedIn: 'root' })
export class OnboardingGuard {
  constructor(
    private router: Router,
    private afAuth: AngularFireAuth,
    private afs: AngularFirestore,
    private injector: Injector
  ) {}

  canActivate(): Observable<boolean | UrlTree> {
    return this.afAuth.authState.pipe(
      take(1),
      switchMap((user) => {
        if (!user) {
          // AuthGuard owns this case; don't compete with it.
          return of(true);
        }
        const status$ = runInInjectionContext(this.injector, () =>
          this.afs
            .doc<any>(`users/${user.uid}`)
            .valueChanges()
            .pipe(
              take(1),
              map((u) => u?.onboardingStatus ?? 'none')
            )
        );
        const hasHistory$ = runInInjectionContext(this.injector, () =>
          this.afs
            .collection<any>('workbooks', (ref) => ref.where('uid', '==', user.uid).limit(1))
            .valueChanges()
            .pipe(
              take(1),
              map((w) => (w?.length ?? 0) > 0)
            )
        );

        return combineLatest([status$, hasHistory$]).pipe(
          map(([status, hasHistory]) => {
            if (status === 'complete') {
              return true;
            }
            if (hasHistory) {
              // Existing member: invite via the app, never block.
              return true;
            }
            return this.router.parseUrl('/onboarding');
          })
        );
      }),
      // A failed lookup must not strand anyone outside the app.
      catchError(() => of(true))
    );
  }
}
