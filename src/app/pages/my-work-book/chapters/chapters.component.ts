import { Component, OnInit } from '@angular/core';
import { Chapter } from 'src/app/models/chapter.interface';
import { WorkbookResponse } from 'src/app/models/workbook.interface';
import { ChaptersService } from 'src/app/services/chapters.service';
import { UtilitiesService } from 'src/app/services/utilities.service';
import { WorkbookService } from 'src/app/services/workbook.service';

@Component({
  selector: 'app-chapters',
  templateUrl: './chapters.component.html',
  styleUrls: ['./chapters.component.scss'],
  standalone: false
})
export class ChaptersComponent implements OnInit {
  public chapters: Chapter[];
  public userQuestionResponses$ =
    this.workbookService.getUserQuestionResponses();
  private readonly MIN_MEANINGFUL_SCORE = 5;
  private readonly HERO_UNLOCK_THRESHOLD = 9;
  private readonly HERO_PREVIEW_ENABLED = true;

  constructor(
    private chaptersService: ChaptersService,
    private utilsService: UtilitiesService,
    private workbookService: WorkbookService
  ) {}

  ngOnInit() {
    this.utilsService.presentLoading();
    this.chaptersService.getChapters().subscribe(
      (data) => {
        this.chapters = data.map((e: any) => {
          return {
            id: e.payload.doc.id,
            ...e.payload.doc.data(),
          };
        });

        this.utilsService.dismissLoader();
      },
      () => {
        this.utilsService.dismissLoader();
      }
    );
  }

  public canAccessChapter(
    responses: WorkbookResponse[] | undefined,
    chapterIndex: number
  ): boolean {
    if (chapterIndex === 0) {
      return true;
    }

    const completed = this.countMeaningfulResponses(responses);
    return completed >= chapterIndex;
  }

  public canAccessHeroChapter(
    responses: WorkbookResponse[] | undefined
  ): boolean {
    if (this.HERO_PREVIEW_ENABLED) {
      return true;
    }

    const required = Math.min(
      this.HERO_UNLOCK_THRESHOLD,
      this.chapters?.length ?? this.HERO_UNLOCK_THRESHOLD
    );
    return this.countMeaningfulResponses(responses) >= required;
  }

  private countMeaningfulResponses(
    responses: WorkbookResponse[] | undefined
  ): number {
    if (!responses?.length) {
      return 0;
    }

    return responses.filter((response) =>
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
}
