import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SurveyService } from 'src/app/services/survey.service';
import { Model } from 'survey-core';
@Component({
  selector: 'app-take-survey',
  templateUrl: './take-survey.component.html',
  styleUrls: ['./take-survey.component.scss'],
  standalone: false,
})
export class TakeSurveyComponent implements OnInit {
  surveyModel: any;
  survey: any;
  constructor(
    private route: ActivatedRoute,
    private surveysService: SurveyService
  ) {}

  ngOnInit() {
    this.surveysService
      .getSurvey(this.route.snapshot.paramMap.get('id'))
      .subscribe({
        next: (res) => {
          this.survey = res;
          this.surveyModel = new Model({ elements: res.questions });
          this.surveyModel.onComplete.add((context) => this.submit(context));
        },
      });
  }

  submit(context) {
    this.surveysService.saveSurveyResponse(this.survey.id, context.data).then();
  }
}
