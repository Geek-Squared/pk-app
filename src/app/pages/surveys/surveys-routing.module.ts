import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { SurveysPage } from './surveys.page';
import { TakeSurveyComponent } from './take-survey/take-survey.component';

const routes: Routes = [
  {
    path: '',
    component: SurveysPage,
  },
  {
    path: 'take-survey/:id',
    component: TakeSurveyComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SurveysPageRoutingModule {}
