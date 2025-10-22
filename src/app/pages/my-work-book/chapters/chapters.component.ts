import { Component, OnInit } from '@angular/core';
import { Chapter } from 'src/app/models/chapter.interface';
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
}
