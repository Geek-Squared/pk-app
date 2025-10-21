import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Chapter } from 'src/app/models/chapter.interface';
import { ChaptersService } from 'src/app/services/chapters.service';
import { UtilitiesService } from 'src/app/services/utilities.service';
import { WorkbookService } from 'src/app/services/workbook.service';

@Component({
  selector: 'app-question-answers',
  templateUrl: './question-answers.component.html',
  styleUrls: ['./question-answers.component.scss'],
  standalone: false
})
export class QuestionAnswersComponent implements OnInit {
  public workbook = [];
  public questionAnswers;

  constructor(
    private workbookService: WorkbookService,
    public route: ActivatedRoute,
    private utilsService: UtilitiesService
  ) {}

  ngOnInit() {
    this.utilsService.presentLoading();
    this.workbookService.getUserQuestionResponses().subscribe(
      (res: any) => {
        this.workbook = res[0]?.responses;
        this.utilsService.dismissLoader();
      },
      () => {
        this.utilsService.dismissLoader();
      }
    );
  }
}
