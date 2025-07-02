import { Component, OnInit } from '@angular/core';
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
    this.surveysService.getActiveSurveys().subscribe({
      next: (data) => {
        this.surveys = data.map((e: any) => {
          return {
            id: e.payload.doc.id,
            ...e.payload.doc.data(),
          };
        }) as Survey[];
        console.log(this.surveys);
        
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
