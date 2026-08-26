import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
    private router: Router,
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

    // Scope, when the survey was opened as an intervention measurement.
    // Without these the response cannot be matched to its timepoint, the
    // due-survey check never finds it, and the prompt reappears forever.
    const interventionId = this.route.snapshot.queryParamMap.get('interventionId');
    const timepoint = this.route.snapshot.queryParamMap.get('timepoint');

    const response: any = {
      ...context.data,
      uid: user?.uid || null,
      userId: user?.uid || null,
      userName: user?.displayName || user?.email || null,
      submittedAt: Date.now(),
    };
    if (interventionId && timepoint) {
      response.interventionId = interventionId;
      response.timepoint = timepoint;
    }

    this.surveysService.saveSurveyResponse(this.survey.id, response).then(() => {
      // Return to the intervention they came from, not the generic list.
      if (interventionId) {
        this.router.navigateByUrl(`/chapters/${interventionId}`);
      }
    });
  }
}
