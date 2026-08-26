import { Component, OnInit } from '@angular/core';
import { combineLatest, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { SurveyService } from 'src/app/services/survey.service';
import { InterventionSurveysService } from 'src/app/services/intervention-surveys.service';

@Component({
  selector: 'app-surveys',
  templateUrl: './surveys.page.html',
  styleUrls: ['./surveys.page.scss'],
  standalone: false
})
export class SurveysPage implements OnInit {
  public surveys: Survey[];
  public isLoading: boolean;

  constructor(
    private surveysService: SurveyService,
    private interventionSurveys: InterventionSurveysService
  ) {}

  ngOnInit(): void {
    this.isLoading = true;
    const uid = JSON.parse(localStorage.getItem('user') || 'null')?.uid;

    combineLatest([
      this.surveysService.getActiveSurveys(),
      this.interventionSurveys.attachedSurveyIds(),
    ])
      .pipe(
        map(([data, attached]: [any[], Set<string>]) =>
          data
            .map((e: any) => ({ id: e.payload.doc.id, ...e.payload.doc.data() }))
            // Measurement surveys are delivered at their timepoint, from the
            // intervention's chapter list. Offering them here as well would
            // record an answer with no intervention or timepoint attached.
            .filter((s: any) => !attached.has(s.id)) as Survey[]
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
