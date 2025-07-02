import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { QuestionsService } from 'src/app/services/questions.service';
import { UtilitiesService } from 'src/app/services/utilities.service';
import { WorkbookService } from 'src/app/services/workbook.service';

@Component({
  selector: 'app-questions',
  templateUrl: './questions.page.html',
  styleUrls: ['./questions.page.scss'],
  standalone: false
})
export class QuestionsPage implements OnInit {
  public pager = {
    index: 0,
    size: 1,
    count: 1,
  };
  public questions: any;
  public questionResponse: string;
  public questionAnswers = [];
  public workBook: any;

  constructor(
    private questionsService: QuestionsService,
    private route: ActivatedRoute,
    private workbookService: WorkbookService,
    private router: Router,
    private utilsService: UtilitiesService
  ) {}

  ngOnInit() {
    this.utilsService.presentLoading();
    this.workbookService.getUserWorkbook().subscribe((data) => {
      this.workBook = data;
    });
    this.questionsService
      .getQuestionsByPostId(this.route.snapshot.paramMap.get('postId'))
      .subscribe((data) => {
        this.questions = data
          .map((e: any) => {
            return {
              id: e.payload.doc.id,
              ...e.payload.doc.data(),
            };
          })
          .sort((a, b) => (a.order > b.order ? 1 : -1));

        this.pager.count = this.questions.length;
        this.utilsService.dismissLoader();
      });
  }

  get filteredQuestions() {
    return this.questions
      ? this.questions.slice(
          this.pager.index,
          this.pager.index + this.pager.size
        )
      : [];
  }

  goTo(index: number, questionId?: string) {
    if (questionId) this.saveAnswerSheet(questionId);
    if (index >= 0 && index < this.pager.count) {
      this.pager.index = index;
    }
    if (this.questionAnswers.some((item) => item?.questionId === questionId)) {
      this.questionResponse = this.questionAnswers.find(
        (item) => item?.questionId === questionId
      )?.response;
    }
  }

  private saveAnswerSheet(question) {
    const removeIndex = this.questionAnswers
      .map(function (item) {
        return item.questionId;
      })
      .indexOf(question.id);

    if (this.questionAnswers.some((item) => item?.questionId === question.id))
      this.questionAnswers.splice(removeIndex, 1);

    this.questionAnswers = [
      ...[
        {
          questionUid: question.id,
          response: this.questionResponse,
          questionNarrative: question.narrative,
          postId: this.route.snapshot.paramMap.get('postId'),
        },
      ],
      ...this.questionAnswers,
    ];
    this.questionResponse = null;
  }

  public checkPosition() {
    return this.pager.index + 1 == this.pager.count;
  }

  saveQuestionResponses(question) {
    this.saveAnswerSheet(question);
    const obj = Object.assign({
      ...this.questionAnswers.map((item) => ({
        response: item.response,
        questionNarrative: item.questionNarrative,
        postId: item.postId,
      })),
    });

    if (this.checkProgress(this.route.snapshot.paramMap.get('postId'))) {
      this.utilsService.presentToast(
        'You have already answered these questions'
      );
      this.router.navigate(['']);
      return;
    } else {
      this.utilsService.presentToast(
        'Please wait while we save your questions.'
      );
      this.workbookService
        .saveQuestionResponses(
          localStorage.getItem('userWorkbookId'),
          obj,
          this.route.snapshot.paramMap.get('postId')
        )
        .then(() => {
          this.utilsService.dismissLoader();
          this.router.navigate(['/my-work-book']);
        })
        .catch((err) => {
          this.utilsService.dismissLoader();
          this.utilsService.presentToast(
            err?.error?.message ? err?.error?.message : 'An error has occurred'
          );
        });
    }
  }

  checkProgress(postId: string) {
    return (this.workBook[0]?.responses).some(
      (element: any) => element?.postId === postId
    );
  }
}
