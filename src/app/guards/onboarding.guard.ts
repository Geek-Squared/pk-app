import { Injectable, Injector, runInInjectionContext } from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { IntakeService } from 'src/app/services/intake.service';
import { Observable, of } from 'rxjs';
import { map, switchMap, take, catchError, retry } from 'rxjs/operators';

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
    private intake: IntakeService,
    private injector: Injector
  ) {}

  canActivate(): Observable<boolean | UrlTree> {
    // authState, not currentUser. On a cold load — a refresh, or entering at
    // the root route — currentUser resolves immediately, before Firebase has
    // attached the auth token to Firestore. The users/{uid} read then arrives
    // unauthenticated, the rules deny it, and the guard decides on an error
    // rather than on data. authState waits for the session to be restored,
    // which is why AuthGuard has always used it.
    return this.afAuth.authState.pipe(
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
              // One retry absorbs the remaining window where the token is
              // still settling; without it a single denied read decides the
              // route.
              retry(1),
              map((u) => {
                const status = u?.onboardingStatus ?? 'none';
                const deferred = this.intake.isDeferredThisSession(user.uid);
                const allow = status === 'complete' || deferred;
                console.log('[OnboardingGuard]', {
                  uid: user.uid,
                  userDocExists: !!u,
                  status,
                  deferredThisSession: deferred,
                  decision: allow ? 'allow' : 'redirect -> /onboarding',
                });
                return allow ? true : this.router.parseUrl('/onboarding');
              })
            )
        );
      }),
      catchError((err) => {
        // Allow, and say so loudly.
        //
        // A failed read is not evidence that onboarding is incomplete — it is
        // evidence that we could not find out. Routing to intake on an error
        // sent members who had already finished back to the form on every
        // refresh. The page itself bounces anyone whose intake is complete, so
        // allowing here cannot let someone skip a genuinely unfinished intake.
        console.error('[OnboardingGuard] lookup failed, allowing through:', err);
        return of(true as boolean | UrlTree);
      })
    );
  }
}
