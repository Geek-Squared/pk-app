import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import { Chapter } from 'src/app/models/chapter.interface';
import { Intervention } from 'src/app/models/intervention.interface';
import { ChaptersService } from 'src/app/services/chapters.service';
import { InterventionsService } from 'src/app/services/interventions.service';
import { UtilitiesService } from 'src/app/services/utilities.service';
import { WorkbookService } from 'src/app/services/workbook.service';
import { WorkbookResponse } from 'src/app/models/workbook.interface';

@Component({
  selector: 'app-chapters',
  templateUrl: './chapters.component.html',
  styleUrls: ['./chapters.component.scss'],
  standalone: false
})
export class ChaptersComponent implements OnInit, OnDestroy {
  public interventions: Intervention[] = [];
  public chapters: Chapter[] = [];
  public selectedInterventionId: string | null = null;
  public selectedInterventionName: string | null = null;
  public isLoading = false;
  public progressPercentage = 0;
  public completedModulesCount = 0;
  public totalChaptersCount = 0;
  public workbookResponses: WorkbookResponse[] = [];
  private readonly subscriptions = new Subscription();
  private readonly MIN_MEANINGFUL_SCORE = 5;

  constructor(
    private interventionsService: InterventionsService,
    private chaptersService: ChaptersService,
    private workbookService: WorkbookService,
    private utilsService: UtilitiesService,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    const routeSub = this.route.paramMap.subscribe((params) => {
      this.selectedInterventionId = params.get('interventionId');
      this.loadData();
    });

    const workbookSub = this.workbookService.getUserQuestionResponses().subscribe(
      (res: any) => {
        this.workbookResponses = res?.[0]?.responses ?? [];
        this.calculateProgress();
      }
    );

    this.subscriptions.add(routeSub);
    this.subscriptions.add(workbookSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private loadData(): void {
    this.isLoading = true;
    this.utilsService.presentLoading();

    if (this.selectedInterventionId) {
      this.loadInterventionChapters(this.selectedInterventionId);
      return;
    }

    this.loadInterventions();
  }

  private loadInterventions(): void {
    this.selectedInterventionName = null;
    this.chapters = [];

    const sub = this.interventionsService
      .getInterventions()
      .pipe(
        map((data) =>
          data.map((e: any) => ({
            id: e.payload.doc.id,
            ...e.payload.doc.data(),
          }))
        )
      )
      .subscribe(
        (interventions) => {
          this.interventions = [...interventions].sort((a, b) => {
            if (typeof a.order === 'number' && typeof b.order === 'number') {
              return a.order - b.order;
            }
            return `${a?.name ?? ''}`.localeCompare(`${b?.name ?? ''}`);
          });
          this.isLoading = false;
          this.utilsService.dismissLoader();
        },
        () => {
          this.isLoading = false;
          this.utilsService.dismissLoader();
        }
      );

    this.subscriptions.add(sub);
  }

  private loadInterventionChapters(interventionId: string): void {
    this.interventions = [];
    this.selectedInterventionName = null;

    const nameSub = this.interventionsService
      .getInterventionById(interventionId)
      .subscribe((intervention) => {
        this.selectedInterventionName = intervention?.name ?? null;
      });

    const chaptersSub = this.chaptersService
      .getChaptersByInterventionId(interventionId)
      .pipe(
        map((data) =>
          data
            .map((e: any) => ({
              id: e.payload.doc.id,
              ...e.payload.doc.data(),
            }))
            .sort((a, b) => {
              if (typeof a.order === 'number' && typeof b.order === 'number') {
                return a.order - b.order;
              }
              return `${a?.title ?? ''}`.localeCompare(`${b?.title ?? ''}`);
            })
        )
      )
      .subscribe(
        (chapters) => {
          this.chapters = chapters;
          this.isLoading = false;
          this.utilsService.dismissLoader();
        },
        () => {
          this.isLoading = false;
          this.utilsService.dismissLoader();
        }
      );

    this.subscriptions.add(nameSub);
    this.subscriptions.add(chaptersSub);
  }

  private calculateProgress() {
    // 1. Determine total count to compare against
    if (this.selectedInterventionId) {
      this.totalChaptersCount = this.chapters.length || 0;
    } else {
      // Fetch ALL chapters from the service for global progress
      this.chaptersService.getChapters().subscribe(all => {
        this.totalChaptersCount = all.length;
        this.updateStats();
      });
      return; // Handled in sub
    }
    this.updateStats();
  }

  private updateStats() {
    if (!this.totalChaptersCount) return;

    // Filter workbook responses for meaningful ones
    const completedIds = new Set(this.workbookResponses.filter(r => {
       if (typeof r?.qualityScore === 'number') return r.qualityScore >= this.MIN_MEANINGFUL_SCORE;
       return !!r?.content;
    }).map(r => r.chapterId));

    if (this.selectedInterventionId) {
      // Local: Count how many of THIS intervention's chapters are completed
      this.completedModulesCount = this.chapters.filter(c => completedIds.has(c.id)).length;
    } else {
      // Global: Just count all unique completed chapter IDs
      this.completedModulesCount = completedIds.size;
    }

    this.progressPercentage = Math.round((this.completedModulesCount / this.totalChaptersCount) * 100);
  }

  public isChapterCompleted(index: number): boolean {
    return index < this.countMeaningfulResponses();
  }

  public isChapterActive(index: number): boolean {
    return index === this.countMeaningfulResponses();
  }

  public canAccessChapter(index: number): boolean {
    if (index === 0) return true;
    return this.countMeaningfulResponses() >= index;
  }

  private countMeaningfulResponses(): number {
    if (!this.workbookResponses?.length) return 0;
    return this.workbookResponses.filter((response: any) => {
      if (typeof response?.qualityScore === 'number') return response.qualityScore >= this.MIN_MEANINGFUL_SCORE;
      return !!response?.content;
    }).length;
  }
}
