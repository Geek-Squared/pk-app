import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { MyWorkBookPageRoutingModule } from './my-work-book-routing.module';

import { MyWorkBookPage } from './my-work-book.page';
import { ChaptersComponent } from './chapters/chapters.component';
import { PostsComponent } from './posts/posts.component';
import { QuestionAnswersComponent } from './question-answers/question-answers.component';
import { SuperheroComponent } from './superhero/superhero.component';
import { BackButtonComponent } from 'src/app/components/back-button/back-button.component';
import { ProgressHeroCardComponent } from 'src/app/components/progress-hero-card/progress-hero-card.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    BackButtonComponent,
    ProgressHeroCardComponent,
    MyWorkBookPageRoutingModule,
  ],
  declarations: [
    MyWorkBookPage,
    ChaptersComponent,
    PostsComponent,
    QuestionAnswersComponent,
    SuperheroComponent,
  ],
})
export class MyWorkBookPageModule {}
