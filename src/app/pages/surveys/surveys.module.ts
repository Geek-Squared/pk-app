import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { SurveysPageRoutingModule } from './surveys-routing.module';

import { SurveysPage } from './surveys.page';
import { SurveyModule } from 'survey-angular-ui';
import { TakeSurveyComponent } from './take-survey/take-survey.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SurveysPageRoutingModule,
    SurveyModule,
  ],
  declarations: [SurveysPage, TakeSurveyComponent],
})
export class SurveysPageModule {}
