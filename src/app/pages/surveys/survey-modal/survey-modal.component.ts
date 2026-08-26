import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { IonicModule, ModalController } from '@ionic/angular';
import { Model } from 'survey-core';
import { SurveyModule } from 'survey-angular-ui';
import { SurveyTimepoint } from 'src/app/models/intervention.interface';
import { InterventionSurveysService } from 'src/app/services/intervention-surveys.service';
import { SurveyService } from 'src/app/services/survey.service';

/**
 * A measurement survey presented as a full-page modal over the intervention.
 *
 * It is deliberately escapable — the close button and "Do it later" both leave
 * without answering, and the prompt returns on the next visit. Someone in
 * distress must never be walled off from the content by a questionnaire.
 */
@Component({
  selector: 'app-survey-modal',
  standalone: true,
  imports: [CommonModule, IonicModule, SurveyModule],
  templateUrl: './survey-modal.component.html',
  styleUrls: ['./survey-modal.component.scss'],
})
export class SurveyModalComponent implements OnInit {
  @Input() surveyId!: string;
  @Input() interventionId!: string;
  @Input() timepoint!: SurveyTimepoint;

  public survey: any;
  public surveyModel: Model | null = null;
  public isLoading = true;
  public isSaving = false;
  public loadFailed = false;

  public questionCount = 0;
  public answeredCount = 0;

  constructor(
    private surveys: SurveyService,
    private interventionSurveys: InterventionSurveysService,
    private modalCtrl: ModalController
  ) {}

  ngOnInit(): void {
    this.surveys.getSurvey(this.surveyId).subscribe({
      next: (res: any) => {
        // Build the model once; this is a live document subscription and
        // rebuilding it under the member would wipe answers in progress.
        if (!this.surveyModel) {
          this.survey = res;
          const definition = res?.schema || { elements: res?.questions || [] };
          const model = new Model(definition);

          // The page supplies its own header, footer and Submit. Left on,
          // SurveyJS's title repeats the heading and its nav button competes
          // with ours — which is exactly how the first build ended up with
          // three titles stacked.
          model.showTitle = false;
          model.showNavigationButtons = false;
          model.showCompletedPage = false;

          model.onValueChanged.add(() => this.recount());
          model.onComplete.add((sender: any) => this.submit(sender.data));

          this.surveyModel = model;
          this.recount();
        }
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Could not load survey', this.surveyId, error);
        this.isLoading = false;
        this.loadFailed = true;
      },
    });
  }

  get overline(): string {
    switch (this.timepoint) {
      case 'baseline':
        return 'Before you start';
      case 'midline':
        return 'Halfway check-in';
      default:
        return "You've finished";
    }
  }

  get heading(): string {
    switch (this.timepoint) {
      case 'baseline':
        return 'A few quick questions';
      case 'midline':
        return 'How is it going so far?';
      default:
        return 'A few last questions';
    }
  }

  get blurb(): string {
    switch (this.timepoint) {
      case 'baseline':
        return 'So we understand where you are starting from. It shapes what the programme offers you.';
      case 'midline':
        return 'The same questions as before, so we can see what has shifted for you.';
      default:
        return 'The same ones you answered at the start — so we can see what has changed for you.';
    }
  }

  get progressPercent(): number {
    if (!this.questionCount) {
      return 0;
    }
    return Math.round((this.answeredCount / this.questionCount) * 100);
  }

  get progressLabel(): string {
    if (!this.questionCount) {
      return '';
    }
    return `${this.answeredCount} of ${this.questionCount} answered`;
  }

  get progressValue(): string {
    return this.questionCount ? `${this.progressPercent}%` : '';
  }

  /** Our footer button drives SurveyJS, so its own navigation can stay hidden. */
  submitNow(): void {
    if (this.isSaving || !this.surveyModel) {
      return;
    }
    // Validates and surfaces per-question errors; completes only if it passes,
    // which fires onComplete and lands in submit().
    this.surveyModel.completeLastPage();
  }

  /** Close without answering. The prompt returns on the next visit. */
  doLater(): void {
    this.modalCtrl.dismiss({ completed: false }, 'later');
  }

  private recount(): void {
    const questions = (this.surveyModel?.getAllQuestions() || []) as any[];
    this.questionCount = questions.length;
    this.answeredCount = questions.filter((q) => !q.isEmpty()).length;
  }

  private async submit(answers: any): Promise<void> {
    if (this.isSaving) {
      return;
    }
    this.isSaving = true;

    const user = JSON.parse(localStorage.getItem('user') || 'null');
    try {
      await this.interventionSurveys.saveResponse(
        this.surveyId,
        user?.uid,
        this.interventionId,
        this.timepoint,
        // userName rides along so staff see a person in the admin, not a uid.
        { ...answers, userName: user?.displayName || user?.email || null }
      );
      await this.modalCtrl.dismiss({ completed: true }, 'completed');
    } catch (error) {
      console.error('Could not save survey response', error);
      this.isSaving = false;
    }
  }
}
