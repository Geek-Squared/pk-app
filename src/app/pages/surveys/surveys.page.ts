import { Component, OnInit } from '@angular/core';
import { combineLatest, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { SurveyService } from 'src/app/services/survey.service';

@Component({
  selector: 'app-surveys',
  templateUrl: './surveys.page.html',
  styleUrls: ['./surveys.page.scss'],
  standalone: false
})
export class SurveysPage implements OnInit {
  public surveys: Survey[];
  public isLoading: boolean;

  constructor(private surveysService: SurveyService) {}

  ngOnInit(): void {
    this.isLoading = true;
    const uid = JSON.parse(localStorage.getItem('user') || 'null')?.uid;

    this.surveysService
      .getActiveSurveys()
      .pipe(
        map((data: any[]) =>
          data.map((e: any) => ({ id: e.payload.doc.id, ...e.payload.doc.data() })) as Survey[]
        ),
        switchMap((surveys: Survey[]) => {
          // Hide surveys the current user has already answered.
          if (!surveys.length || !uid) {
            return of(surveys);
          }
          return combineLatest(
            surveys.map((s) =>
              this.surveysService
                .hasResponded(s.id as string, uid)
                .pipe(map((answered) => ({ survey: s, answered })))
            )
          ).pipe(
            map((results) => results.filter((r) => !r.answered).map((r) => r.survey))
          );
        })
      )
      .subscribe({
        next: (surveys: Survey[]) => {
          this.surveys = surveys;
          this.isLoading = false;
        },
        error: () => {
          this.isLoading = false;
        },
      });
  }
}

export interface Survey {
  name: string;
  status: boolean;
  questions: any[];
  id?: string;
}
