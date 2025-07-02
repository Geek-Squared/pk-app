import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { MyWorkBookPageRoutingModule } from './my-work-book-routing.module';

import { MyWorkBookPage } from './my-work-book.page';
import { ChaptersComponent } from './chapters/chapters.component';
import { PostsComponent } from './posts/posts.component';
import { QuestionAnswersComponent } from './question-answers/question-answers.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    MyWorkBookPageRoutingModule,
  ],
  declarations: [
    MyWorkBookPage,
    ChaptersComponent,
    PostsComponent,
    QuestionAnswersComponent,
  ],
})
export class MyWorkBookPageModule {}
