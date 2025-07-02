import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Chapter } from 'src/app/models/chapter.interface';
import { ChaptersService } from 'src/app/services/chapters.service';
import { UtilitiesService } from 'src/app/services/utilities.service';

@Component({
  selector: 'app-chapters',
  templateUrl: './chapters.page.html',
  styleUrls: ['./chapters.page.scss'],
  standalone: false
})
export class ChaptersPage implements OnInit {
  public chapters: Chapter[];

  constructor(
    private chaptersService: ChaptersService,
    private utilsService: UtilitiesService,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.getChapters();
  }

  private getChapters() {
    this.utilsService.presentLoading();
    this.chaptersService
      .getChaptersByInterventionId(
        this.route.snapshot.paramMap.get('interventionId')
      )
      .subscribe(
        (data) => {
          this.chapters = data
            .map((e: any) => {
              return {
                id: e.payload.doc.id,
                ...e.payload.doc.data(),
              };
            })
            .sort((a, b) =>
              a.order > b.order ? 1 : b.order > a.order ? -1 : 0
            );
          this.utilsService.dismissLoader();
        },
        () => {
          this.utilsService.dismissLoader();
        }
      );
  }

  search(value) {
    this.chaptersService.searchChapters(value).subscribe((res: any) => {
      this.chapters = res.map((e: any) => {
        return {
          id: e.payload.doc.id,
          ...e.payload.doc.data(),
        };
      });
    });
  }
}
