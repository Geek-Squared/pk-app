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
          // Admin stores the SurveyJS definition under `schema` ({ title, elements }).
          // Fall back to a legacy `questions` array if present.
          const definition = res?.schema || { elements: res?.questions || [] };
          this.surveyModel = new Model(definition);
          this.surveyModel.onComplete.add((context) => this.submit(context));
        },
      });
  }

  submit(context) {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    const response = {
      ...context.data,
      uid: user?.uid || null,
      userId: user?.uid || null,
      userName: user?.displayName || user?.email || null,
      submittedAt: Date.now(),
    };
    this.surveysService.saveSurveyResponse(this.survey.id, response).then();
  }
}
