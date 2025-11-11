import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Chapter } from 'src/app/models/chapter.interface';
import { ChaptersService } from 'src/app/services/chapters.service';
import { UtilitiesService } from 'src/app/services/utilities.service';

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

  constructor(
    private chaptersService: ChaptersService,
    private utilsService: UtilitiesService,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.getChapters();
  }

  private getChapters(): void {
    this.isLoading = true;
    this.utilsService.presentLoading();
    this.chaptersService
      .getChaptersByInterventionId(
        this.route.snapshot.paramMap.get('interventionId')
      )
      .subscribe(
        (data) => {
          this.chapters = data
            .map((e: any) => ({
              id: e.payload.doc.id,
              ...e.payload.doc.data(),
            }))
            .sort((a, b) => (a.order > b.order ? 1 : b.order > a.order ? -1 : 0));

          this.filteredChapters = [...this.chapters];
          this.isLoading = false;
          this.utilsService.dismissLoader();
        },
        () => {
          this.isLoading = false;
          this.utilsService.dismissLoader();
        }
      );
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
