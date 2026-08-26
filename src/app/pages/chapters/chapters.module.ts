import { BackButtonComponent } from 'src/app/components/back-button/back-button.component';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ChaptersPageRoutingModule } from './chapters-routing.module';

import { ChaptersPage } from './chapters.page';
import { ProgressHeroCardComponent } from 'src/app/components/progress-hero-card/progress-hero-card.component';
import { SurveyModalComponent } from 'src/app/pages/surveys/survey-modal/survey-modal.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    BackButtonComponent,
    ProgressHeroCardComponent,
    SurveyModalComponent,
    ChaptersPageRoutingModule
  ],
  declarations: [ChaptersPage]
})
export class ChaptersPageModule {}
