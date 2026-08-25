import { Injectable, Injector, runInInjectionContext } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import firebase from 'firebase/compat/app';
import { Observable, of } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import { Intake, IntakeStatus } from 'src/app/models/intake.interface';

export const INTAKE_STEPS = ['identity', 'demographics', 'selection', 'confirm'] as const;
export type IntakeStep = (typeof INTAKE_STEPS)[number];

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
  async saveStep(uid: string, step: IntakeStep, data: Partial<Intake>): Promise<void> {
    const now = firebase.firestore.FieldValue.serverTimestamp();
    await runInInjectionContext(this.injector, () =>
      this.afs.doc(`intakes/${uid}`).set(
        {
          ...data,
          uid,
          status: 'in_progress' as IntakeStatus,
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
