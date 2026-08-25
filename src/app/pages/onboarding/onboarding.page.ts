import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { AlertController, ToastController } from '@ionic/angular';
import { Observable, of } from 'rxjs';
import { take } from 'rxjs/operators';
import { IntakeService, IntakeStep, INTAKE_STEPS } from 'src/app/services/intake.service';
import { CareAssignmentService } from 'src/app/services/care-assignment.service';
import { InterventionsService } from 'src/app/services/interventions.service';
import { Intervention } from 'src/app/models/intervention.interface';
import { Intake } from 'src/app/models/intake.interface';

@Component({
  selector: 'app-onboarding',
  templateUrl: './onboarding.page.html',
  styleUrls: ['./onboarding.page.scss'],
  standalone: false,
})
export class OnboardingPage implements OnInit {
  readonly steps = INTAKE_STEPS;
  step: IntakeStep = 'identity';
  uid = '';
  saving = false;

  // identity
  fullName = '';
  age: number | null = null;
  phoneNumber = '';
  email = '';

  // demographics — these three are the entire set
  gender = '';
  region = '';
  language = '';
  genderOptions: string[] = [];
  regionOptions: string[] = [];
  languageOptions: string[] = [];
  consentGiven = false;

  // selection
  selectable$: Observable<Intervention[]> = of([]);
  selected = new Set<string>();

  errors: Record<string, string> = {};

  constructor(
    private intake: IntakeService,
    private care: CareAssignmentService,
    private interventions: InterventionsService,
    private afAuth: AngularFireAuth,
    private fns: AngularFireFunctions,
    private router: Router,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) {}

  async ngOnInit(): Promise<void> {
    const user = await this.afAuth.currentUser;
    if (!user) {
      this.router.navigateByUrl('/login');
      return;
    }
    this.uid = user.uid;
    this.email = user.email ?? '';

    const existing = await this.intake.getIntake(this.uid).pipe(take(1)).toPromise();
    this.hydrate(existing ?? null);
    this.step = this.intake.resumeStep(existing ?? null);
    this.loadConfig();
    this.intake.setOnboardingStatus(this.uid, 'in_progress');
  }

  /** Restore saved answers, then any draft on top for the in-flight step. */
  private hydrate(existing: Intake | null): void {
    if (existing) {
      this.fullName = existing.fullName ?? '';
      this.age = existing.age ?? null;
      this.phoneNumber = existing.phoneNumber ?? '';
      this.email = existing.email || this.email;
      this.gender = existing.gender ?? '';
      this.region = existing.region ?? '';
      this.language = existing.language ?? '';
      this.selected = new Set(existing.selectedInterventionIds ?? []);
    }
    for (const s of INTAKE_STEPS) {
      const draft = this.intake.readDraft(this.uid, s);
      if (draft) Object.assign(this, draft);
    }
  }

  private loadConfig(): void {
    this.selectable$ = this.interventions.getSelectableInterventions(this.age ?? undefined);
    this.intake.getOnboardingConfig().pipe(take(1)).subscribe((c) => {
      // Fall back to a usable set rather than an empty dropdown if the
      // programme has not configured these yet.
      this.genderOptions = c?.genderOptions?.length
        ? c.genderOptions
        : ['Female', 'Male', 'Non-binary', 'Prefer not to say'];
      this.regionOptions = c?.regionOptions ?? [];
      this.languageOptions = c?.languageOptions?.length ? c.languageOptions : ['English'];
    });
  }

  /** Mirror the in-flight step so an interruption loses nothing. */
  touch(): void {
    this.intake.saveDraft(this.uid, this.step, this.stepData());
  }

  private stepData(): any {
    switch (this.step) {
      case 'identity':
        return { fullName: this.fullName, age: this.age, phoneNumber: this.phoneNumber };
      case 'demographics':
        return { gender: this.gender, region: this.region, language: this.language };
      case 'selection':
        return { selected: Array.from(this.selected) };
      default:
        return {};
    }
  }

  toggle(id: string): void {
    this.selected.has(id) ? this.selected.delete(id) : this.selected.add(id);
    this.touch();
  }

  isSelected(id: string): boolean {
    return this.selected.has(id);
  }

  stepIndex(): number {
    return this.steps.indexOf(this.step);
  }

  back(): void {
    const i = this.stepIndex();
    if (i > 0) this.step = this.steps[i - 1] as IntakeStep;
  }

  private validateCurrent(): boolean {
    this.errors = {};
    if (this.step === 'identity') {
      const n = this.intake.validateName(this.fullName);
      const a = this.intake.validateAge(this.age);
      const p = this.intake.validatePhone(this.phoneNumber);
      if (n) this.errors['fullName'] = n;
      if (a) this.errors['age'] = a;
      if (p) this.errors['phoneNumber'] = p;
    }
    if (this.step === 'demographics') {
      if (!this.gender) this.errors['gender'] = 'Please choose an option.';
      if (!this.region) this.errors['region'] = 'Please choose where you are based.';
      if (!this.language) this.errors['language'] = 'Please choose your preferred language.';
      if (!this.consentGiven) {
        this.errors['consent'] = 'Please agree before we store this information.';
      }
    }
    return Object.keys(this.errors).length === 0;
  }

  async next(): Promise<void> {
    if (!this.validateCurrent() || this.saving) return;
    this.saving = true;
    try {
      if (this.step === 'identity') {
        await this.intake.saveStep(this.uid, 'identity', {
          fullName: this.fullName.trim(),
          age: Number(this.age),
          phoneNumber: this.phoneNumber.trim(),
          email: this.email,
        });
        // Age drives which pills lead, so refresh the list once it is known.
        this.loadConfig();
      } else if (this.step === 'demographics') {
        await this.intake.saveStep(this.uid, 'demographics', {
          gender: this.gender,
          region: this.region,
          language: this.language,
          consent: {
            demographicsVersion: 'v1',
            demographicsAgreedAt: new Date(),
          } as any,
        });
      } else if (this.step === 'selection') {
        await this.intake.saveStep(this.uid, 'selection', {
          selectedInterventionIds: Array.from(this.selected),
        });
      }
      const i = this.stepIndex();
      if (i < this.steps.length - 1) this.step = this.steps[i + 1] as IntakeStep;
    } catch (e) {
      await this.toast('Could not save just now — your answers are kept, please try again.');
    } finally {
      this.saving = false;
    }
  }

  async finish(): Promise<void> {
    if (this.saving) return;
    this.saving = true;
    try {
      await this.care.composeFromSelections(this.uid, Array.from(this.selected));
      await this.intake.saveStep(this.uid, 'confirm', {});
      await this.intake.completeIntake(this.uid);
      this.router.navigateByUrl('/home');
    } catch (e) {
      await this.toast('Could not finish just now — please try again.');
    } finally {
      this.saving = false;
    }
  }

  /**
   * Reachable from every step. With no free-text field there is nothing to
   * detect distress, so support is always one tap away rather than triggered.
   */
  async talkToSomeone(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Talk to a counsellor',
      message:
        'You can speak to a counsellor now. You do not need to finish this form first.',
      buttons: [
        { text: 'Not now', role: 'cancel' },
        {
          text: 'Connect me',
          handler: async () => {
            try {
              await this.fns.httpsCallable('requestCounsellorChat')({}).toPromise();
              this.router.navigateByUrl('/messages');
            } catch {
              await this.toast('Could not connect right now — please try Messages.');
            }
          },
        },
      ],
    });
    await alert.present();
  }

  private async toast(message: string): Promise<void> {
    const t = await this.toastCtrl.create({ message, duration: 3000, position: 'bottom' });
    await t.present();
  }
}
