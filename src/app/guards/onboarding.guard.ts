import { Injectable, Injector, runInInjectionContext } from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Observable, from, of } from 'rxjs';
import { map, switchMap, take, catchError } from 'rxjs/operators';
import { IntakeService } from 'src/app/services/intake.service';

/**
 * Sends members who have not completed intake to /onboarding.
 *
 * Reads intakes/{uid} from the SERVER, and nothing else.
 *
 * Earlier versions read users/{uid}.onboardingStatus. That was a mirror added
 * purely for the guard's convenience, and it sat on the one document the app
 * writes to at startup — updateOnlineStatus() fires on every launch. A local
 * write with no server copy yet makes Firestore serve a latency-compensated
 * document containing only the fields just written, so the guard saw no status,
 * decided "not onboarded", and redirected. The onboarding page then read the
 * real intake, found it complete, and bounced to /home — the flash of the
 * onboarding screen on refresh.
 *
 * intakes/{uid} has no such race: nothing writes it at boot, and it is the
 * authoritative record rather than a copy. Reading it here is also no privacy
 * concern — the member is reading their own document, which the rules already
 * permit.
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
    // authState, not currentUser: it waits for the session to be restored,
    // so the read below carries a real auth token.
    return this.afAuth.authState.pipe(
      take(1),
      switchMap((user) => {
        if (!user) {
          return of(true as boolean | UrlTree);
        }

        return this.readIntakeStatus(user.uid).pipe(
          map((status) => {
            const deferred = this.intake.isDeferredThisSession(user.uid);
            const allow = status === 'complete' || deferred;
            console.log('[OnboardingGuard]', {
              uid: user.uid,
              intakeStatus: status,
              deferredThisSession: deferred,
              decision: allow ? 'allow' : 'redirect -> /onboarding',
            });
            return allow ? true : this.router.parseUrl('/onboarding');
          })
        );
      }),
      catchError((err) => {
        // Allow. A failed read means we could not find out, not that intake is
        // incomplete — and the onboarding page bounces anyone already finished,
        // so nothing can be skipped by allowing here.
        console.error('[OnboardingGuard] lookup failed, allowing through:', err);
        return of(true as boolean | UrlTree);
      })
    );
  }

  /**
   * Server-first, cache as a fallback. `source: 'server'` throws when offline,
   * which must not strand a member outside the app, so the cached copy is
   * accepted rather than failing the navigation.
   */
  private readIntakeStatus(uid: string): Observable<string> {
    const ref = () =>
      runInInjectionContext(this.injector, () => this.afs.doc<any>(`intakes/${uid}`).ref);

    return from(ref().get({ source: 'server' })).pipe(
      catchError(() => from(ref().get({ source: 'cache' }))),
      map((snap: any) => (snap?.exists ? snap.data()?.status ?? 'none' : 'none')),
      take(1)
    );
  }
}
