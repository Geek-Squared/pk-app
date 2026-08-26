import { Injectable, Injector, runInInjectionContext } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import firebase from 'firebase/compat/app';
import { Observable, of } from 'rxjs';
import { switchMap, map, take } from 'rxjs/operators';
import { Intake, IntakeStatus } from 'src/app/models/intake.interface';

export const INTAKE_STEPS = ['identity', 'demographics', 'selection', 'confirm'] as const;
export type IntakeStep = (typeof INTAKE_STEPS)[number];

/**
 * When onboarding shipped. Accounts created before this predate the feature,
 * so their owners are offered a deferral rather than being walled — 270 of the
 * 271 existing members would otherwise meet a four-step form on next open.
 *
 * Read from the Firebase Auth account's own creationTime, not a Firestore
 * field: only 3 of 200 user documents carry `createdAt`, so it cannot classify
 * anybody.
 */
export const ONBOARDING_ROLLOUT_MS = Date.parse('2026-08-25T00:00:00Z');

/**
 * Reads and writes `intakes/{uid}` — the member's onboarding answers.
 *
 * Deliberately NOT stored on `users/{uid}`: that document is read by other
 * members to render names and avatars in chats, and Firestore has no
 * field-level read control.
 */
@Injectable({ providedIn: 'root' })
export class IntakeService {
  constructor(
    private afs: AngularFirestore,
    private afAuth: AngularFireAuth,
    private injector: Injector
  ) {}

  private draftKey(uid: string, step: string): string {
    // uid-scoped so a shared device never leaks one member's draft into another
    return `pk.intake.draft.${uid}.${step}`;
  }

  /** Programme-managed onboarding config: the option lists and defaults. */
  getOnboardingConfig(): Observable<any> {
    return runInInjectionContext(this.injector, () =>
      this.afs.doc<any>('config/onboarding').valueChanges()
    );
  }

  getIntake(uid: string): Observable<Intake | null> {
    return runInInjectionContext(this.injector, () =>
      this.afs
        .doc<Intake>(`intakes/${uid}`)
        .valueChanges()
        .pipe(map((d) => d ?? null))
    );
  }

  /**
   * One-shot read that waits for a real snapshot instead of accepting whatever
   * the local cache can answer with. Used where a decision is made on the
   * result — valueChanges() can serve a latency-compensated local document that
   * is missing every field not written on this device.
   */
  getIntakeOnce(uid: string): Observable<Intake | null> {
    return runInInjectionContext(this.injector, () =>
      this.afs
        .doc<Intake>(`intakes/${uid}`)
        .get()
        .pipe(map((snap) => (snap.exists ? ((snap.data() as Intake) ?? null) : null)))
    );
  }

  /** The signed-in member's intake, or null when there is none yet. */
  currentIntake$(): Observable<Intake | null> {
    return this.afAuth.authState.pipe(
      switchMap((user) => (user ? this.getIntake(user.uid) : of(null)))
    );
  }

  /**
   * Persist one completed step. Merge-writes so an interrupted intake resumes
   * without re-answering, and so a step is durable as soon as it is answered.
   */
  async saveStep(
    uid: string,
    step: IntakeStep,
    data: Partial<Intake>,
    opts: { keepStatus?: boolean } = {}
  ): Promise<void> {
    const now = firebase.firestore.FieldValue.serverTimestamp();
    // keepStatus is for edits after completion: writing 'in_progress' there
    // would un-complete a finished intake and trap the member in the guard.
    const statusPatch = opts.keepStatus ? {} : { status: 'in_progress' as IntakeStatus };
    await runInInjectionContext(this.injector, () =>
      this.afs.doc(`intakes/${uid}`).set(
        {
          ...data,
          uid,
          ...statusPatch,
          completedSteps: firebase.firestore.FieldValue.arrayUnion(step),
          updatedAt: now,
          createdAt: now,
        },
        { merge: true }
      )
    );
    this.clearDraft(uid, step);
  }

  /** Marks intake complete. The only place `status` becomes 'complete'. */
  async completeIntake(uid: string): Promise<void> {
    const now = firebase.firestore.FieldValue.serverTimestamp();
    await runInInjectionContext(this.injector, () =>
      this.afs.doc(`intakes/${uid}`).set(
        { status: 'complete' as IntakeStatus, completedAt: now, updatedAt: now },
        { merge: true }
      )
    );
    await this.setOnboardingStatus(uid, 'complete');
    this.clearAllDrafts(uid);
  }

  /**
   * A non-sensitive mirror on the user document so the guard can decide without
   * reading the intake. Nothing else about intake is written here.
   */
  async setOnboardingStatus(uid: string, status: 'in_progress' | 'complete'): Promise<void> {
    // Never downgrade. Landing on the onboarding page used to stamp
    // 'in_progress' unconditionally, so a member who had already finished was
    // knocked back to incomplete on every refresh — and the guard then sent
    // them straight back here. One-way transition closes that loop for good,
    // wherever the call comes from.
    if (status === 'in_progress') {
      const current = await runInInjectionContext(this.injector, () =>
        this.afs.doc<any>(`users/${uid}`).valueChanges().pipe(take(1)).toPromise()
      );
      if (current?.onboardingStatus === 'complete') {
        return;
      }
    }
    await runInInjectionContext(this.injector, () =>
      this.afs.doc(`users/${uid}`).set({ onboardingStatus: status }, { merge: true })
    );
  }

  /** Clears the demographic fields, keeping care history intact. */
  async withdrawDemographicsConsent(uid: string): Promise<void> {
    await runInInjectionContext(this.injector, () =>
      this.afs.doc(`intakes/${uid}`).set(
        {
          gender: '',
          region: '',
          language: '',
          consent: { demographicsWithdrawnAt: firebase.firestore.FieldValue.serverTimestamp() },
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
    );
  }

  /** First step with no answer yet, so an interrupted intake resumes in place. */
  resumeStep(intake: Intake | null): IntakeStep {
    const done = intake?.completedSteps ?? [];
    return (INTAKE_STEPS.find((s) => !done.includes(s)) ?? 'confirm') as IntakeStep;
  }

  // --- deferral -----------------------------------------------------------
  // Session-scoped on purpose: an existing member can get on with what they
  // opened the app to do, and is asked again next time they launch it. Nothing
  // is written to their record, so the deferral never hardens into an opt-out.

  private deferKey(uid: string): string {
    return `pk.intake.deferred.${uid}`;
  }

  deferForSession(uid: string): void {
    try {
      sessionStorage.setItem(this.deferKey(uid), '1');
    } catch {}
  }

  isDeferredThisSession(uid: string): boolean {
    try {
      return sessionStorage.getItem(this.deferKey(uid)) === '1';
    } catch {
      return false;
    }
  }

  /**
   * Records that the walkthrough has been seen, on the user document rather
   * than only in localStorage — otherwise a returning member is shown it again
   * on every new device or after clearing site data.
   */
  async markHowToSeen(uid: string): Promise<void> {
    await runInInjectionContext(this.injector, () =>
      this.afs.doc(`users/${uid}`).set(
        { howToSeenAt: firebase.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      )
    );
  }

  /** True when the account predates onboarding, so a deferral is offered. */
  predatesOnboarding(creationTime?: string | null): boolean {
    if (!creationTime) {
      // Unknown age: treat as existing. Wrongly offering a deferral is a far
      // smaller harm than wrongly walling a long-standing member.
      return true;
    }
    const created = Date.parse(creationTime);
    return Number.isNaN(created) ? true : created < ONBOARDING_ROLLOUT_MS;
  }

  // --- draft mirror -------------------------------------------------------
  // Covers the partly-filled step the member is looking at when the app dies.
  // Completed steps are already durable in Firestore.

  saveDraft(uid: string, step: string, data: any): void {
    try {
      localStorage.setItem(this.draftKey(uid, step), JSON.stringify(data));
    } catch {
      // Storage can be unavailable or full; a lost draft is recoverable, a
      // crash on every keystroke is not.
    }
  }

  readDraft(uid: string, step: string): any | null {
    try {
      const raw = localStorage.getItem(this.draftKey(uid, step));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  clearDraft(uid: string, step: string): void {
    try {
      localStorage.removeItem(this.draftKey(uid, step));
    } catch {}
  }

  clearAllDrafts(uid: string): void {
    INTAKE_STEPS.forEach((s) => this.clearDraft(uid, s));
  }

  // --- validation ---------------------------------------------------------
  // Messages are shown to the member, so they say what is wrong in plain words.

  validateAge(raw: any): string | null {
    const age = Number(raw);
    if (!raw && raw !== 0) return 'Please tell us your age.';
    if (!Number.isInteger(age)) return 'Please enter your age as a whole number.';
    // No minimum: adolescents are an intended audience.
    if (age < 1 || age > 120) return 'Please enter an age between 1 and 120.';
    return null;
  }

  validatePhone(raw: string): string | null {
    if (!raw?.trim()) return 'Please give us a phone number we can reach you on.';
    if (this.toDialable(raw).replace('+', '').length < 7) {
      return "That number looks too short — please check it's complete.";
    }
    return null;
  }

  validateName(raw: string): string | null {
    if (!raw?.trim()) return 'Please tell us your name.';
    if (raw.trim().length < 2) return 'Please enter your full name.';
    return null;
  }

  /** Same rule as the Referrals call button: digits, plus a leading +. */
  toDialable(raw: string): string {
    if (!raw) return '';
    const plus = raw.trim().startsWith('+') ? '+' : '';
    const digits = raw.replace(/\D/g, '');
    return digits ? `${plus}${digits}` : '';
  }
}
