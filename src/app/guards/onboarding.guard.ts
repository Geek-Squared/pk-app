import { Injectable, Injector, runInInjectionContext } from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Observable, from, of } from 'rxjs';
import { map, switchMap, take, catchError } from 'rxjs/operators';

/**
 * Sends members who have not completed intake to /onboarding.
 *
 * Deliberately simple: one identity lookup, one Firestore read, one decision.
 *
 * An earlier version re-subscribed to `authState` and also queried `workbooks`
 * to detect long-standing members. Two reads in a guard meant two ways to fail,
 * and because it fell open on error a failure was indistinguishable from
 * "no onboarding needed" — the guard appeared to do nothing at all.
 *
 * Existing members are now handled on the onboarding page itself, which offers
 * them a skip. That keeps the "never lock anyone out" guarantee while making
 * the guard's behaviour observable rather than silent.
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
    // currentUser resolves once, deterministically. AuthGuard has already
    // established there is a verified session by the time this runs, so we do
    // not re-derive it from the authState stream.
    return from(this.afAuth.currentUser).pipe(
      switchMap((user) => {
        if (!user) {
          console.log('[OnboardingGuard] no session; AuthGuard owns this');
          return of(true as boolean | UrlTree);
        }

        return runInInjectionContext(this.injector, () =>
          this.afs
            .doc<any>(`users/${user.uid}`)
            .valueChanges()
            .pipe(
              take(1),
              map((u) => {
                const status = u?.onboardingStatus ?? 'none';
                const allow = status === 'complete';
                console.log('[OnboardingGuard]', {
                  uid: user.uid,
                  userDocExists: !!u,
                  status,
                  decision: allow ? 'allow' : 'redirect -> /onboarding',
                });
                return allow ? true : this.router.parseUrl('/onboarding');
              })
            )
        );
      }),
      catchError((err) => {
        // Send them to onboarding rather than into the app: a new member seeing
        // intake twice is a small annoyance, whereas skipping it silently is
        // the bug we have been chasing. The page itself offers a skip, so an
        // existing member can still get past it.
        console.error('[OnboardingGuard] lookup failed, routing to onboarding:', err);
        return of(this.router.parseUrl('/onboarding'));
      })
    );
  }
}
