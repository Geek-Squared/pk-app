import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { ChatComponent } from '../messages/chat/chat.component';
import { ChaptersComponent } from './chapters/chapters.component';

import { MyWorkBookPage } from './my-work-book.page';
import { PostsComponent } from './posts/posts.component';
import { QuestionAnswersComponent } from './question-answers/question-answers.component';
import { SuperheroComponent } from './superhero/superhero.component';

const routes: Routes = [
  {
    path: '',
    component: MyWorkBookPage,
    children: [
      { path: '', redirectTo: 'chapters', pathMatch: 'full' },
      { path: 'chapters', component: ChaptersComponent },
      { path: 'posts/:chapterId', component: PostsComponent },
      { path: 'questionAnswers/:postId', component: QuestionAnswersComponent },
      { path: 'chapter-ten', component: SuperheroComponent },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MyWorkBookPageRoutingModule {}
