import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import { Chapter } from 'src/app/models/chapter.interface';
import { Intervention } from 'src/app/models/intervention.interface';
import { ChaptersService } from 'src/app/services/chapters.service';
import { InterventionsService } from 'src/app/services/interventions.service';
import { UtilitiesService } from 'src/app/services/utilities.service';

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
  private readonly subscriptions = new Subscription();

  constructor(
    private interventionsService: InterventionsService,
    private chaptersService: ChaptersService,
    private utilsService: UtilitiesService,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    const routeSub = this.route.paramMap.subscribe((params) => {
      this.selectedInterventionId = params.get('interventionId');
      this.loadData();
    });

    this.subscriptions.add(routeSub);
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
}
