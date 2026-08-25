import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Chapter } from 'src/app/models/chapter.interface';
import { ChaptersService } from 'src/app/services/chapters.service';
import { UtilitiesService } from 'src/app/services/utilities.service';
import { WorkbookService } from 'src/app/services/workbook.service';
import { WorkbookResponse } from 'src/app/models/workbook.interface';
import { InterventionsService } from 'src/app/services/interventions.service';
import { InterventionSurveysService } from 'src/app/services/intervention-surveys.service';
import { DueSurvey } from 'src/app/services/intervention-surveys.service';

@Component({
  selector: 'app-chapters',
  templateUrl: './chapters.page.html',
  styleUrls: ['./chapters.page.scss'],
  standalone: false,
})
export class ChaptersPage implements OnInit {
  public chapters: Chapter[] = [];
  public filteredChapters: Chapter[] = [];
  public isLoading = false;
  public interventionName = 'Chapters';
  public activeChapterIndex = 0;
  public progressPercentage = 0;
  private workbookResponses: WorkbookResponse[] = [];
  private readonly MIN_MEANINGFUL_SCORE = 5;

  public get completedChaptersCount(): number {
    return Math.min(this.countMeaningfulResponses(), this.chapters.length);
  }

  public get totalChaptersCount(): number {
    return this.chapters.length;
  }

  constructor(
    private chaptersService: ChaptersService,
    private interventionSurveys: InterventionSurveysService,
    private interventionsService: InterventionsService,
    private utilsService: UtilitiesService,
    private route: ActivatedRoute,
    private workbookService: WorkbookService,
    private router: Router
  ) {}

  /** Measurement surveys owed at this intervention's current timepoint. */
  dueSurveys: DueSurvey[] = [];

  ngOnInit() {
    this.getChapters();
    this.listenForWorkbookProgress();
    this.watchDueSurveys();
  }

  private watchDueSurveys(): void {
    const interventionId = this.route.snapshot.paramMap.get('interventionId');
    const uid = JSON.parse(localStorage.getItem('user') || 'null')?.uid;
    if (!interventionId || !uid) {
      return;
    }
    this.interventionSurveys
      .dueSurveys(uid, interventionId)
      .subscribe((due) => (this.dueSurveys = due));
  }

  /**
   * Surveys are never a gate. Someone can dismiss the prompt and carry on with
   * the content; it reappears next visit until answered. Blocking a person in
   * distress behind a questionnaire is not a trade worth making for data.
   */
  dismissSurveyPrompt(): void {
    this.dueSurveys = [];
  }

  openSurvey(due: DueSurvey): void {
    this.router.navigate(['/surveys', due.surveyId], {
      queryParams: { interventionId: due.interventionId, timepoint: due.timepoint },
    });
  }

  surveyPromptLabel(): string {
    const point = this.dueSurveys[0]?.timepoint;
    if (point === 'baseline') {
      return 'Before you start, a few questions';
    }
    if (point === 'midline') {
      return 'You are halfway — a few questions';
    }
    return 'You have finished — a few last questions';
  }

  private async getChapters(): Promise<void> {
    this.isLoading = true;
    const interventionId = this.route.snapshot.paramMap.get('interventionId');
    
    if (interventionId) {
      // 1. Fetch intervention name
      this.interventionsService.getInterventionById(interventionId).subscribe(int => {
        if (int) this.interventionName = int.name;
      });

      // 2. Fetch chapters
      this.chaptersService.getChaptersByInterventionId(interventionId).subscribe(data => {
        this.chapters = data
          .map((e: any) => ({
            id: e.payload.doc.id,
            ...e.payload.doc.data(),
          }))
          .sort((a, b) => (a.order > b.order ? 1 : b.order > a.order ? -1 : 0));

        this.filteredChapters = [...this.chapters];
        this.updateProgressCalculations();
        this.isLoading = false;
      });
    }
  }

  private updateProgressCalculations(): void {
    if (!this.chapters.length) return;
    
    const completedCount = this.countMeaningfulResponses();
    this.activeChapterIndex = Math.min(completedCount, this.chapters.length - 1);
    this.progressPercentage = Math.round((completedCount / this.chapters.length) * 100);
  }

  public isChapterCompleted(index: number): boolean {
    return index < this.countMeaningfulResponses();
  }

  public isChapterActive(index: number): boolean {
    return index === this.countMeaningfulResponses();
  }

  handleChapterClick(chapterId: string, index: number): void {
    if (!this.canAccessChapter(index)) {
      this.utilsService.presentToast(
        'Complete earlier chapters with meaningful reflections to unlock this one.'
      );
      return;
    }

    this.router.navigate(['/posts', chapterId]);
  }

  canAccessChapter(index: number): boolean {
    if (index === 0) {
      return true;
    }

    const completed = this.countMeaningfulResponses();
    return completed >= index;
  }

  private listenForWorkbookProgress(): void {
    this.workbookService.getUserQuestionResponses().subscribe(
      (res: any) => {
        this.workbookResponses = res?.[0]?.responses ?? [];
        this.updateProgressCalculations();
      },
      () => undefined
    );
  }

  private countMeaningfulResponses(): number {
    if (!this.workbookResponses?.length) {
      return 0;
    }

    return this.workbookResponses.filter((response) =>
      this.isMeaningfulResponse(response)
    ).length;
  }

  private isMeaningfulResponse(response: WorkbookResponse | any): boolean {
    if (!response) {
      return false;
    }

    if (typeof response?.qualityScore === 'number') {
      return response.qualityScore >= this.MIN_MEANINGFUL_SCORE;
    }

    const serialized = JSON.stringify(response?.content ?? '')
      .replace(/[\n\r]/g, ' ')
      .trim()
      .toLowerCase();

    if (!serialized) {
      return false;
    }

    const banned = ['x', 'n/a', 'na', 'none', 'nil'];
    return !banned.includes(serialized);
  }

  search(value: string | null | undefined): void {
    if (!value) {
      this.filteredChapters = [...this.chapters];
      return;
    }

    this.chaptersService.searchChapters(value).subscribe(
      (res: any) => {
        this.filteredChapters = res
          .map((e: any) => ({
            id: e.payload.doc.id,
            ...e.payload.doc.data(),
          }))
          .sort((a, b) => (a.order > b.order ? 1 : b.order > a.order ? -1 : 0));
      },
      () => undefined
    );
  }
}
