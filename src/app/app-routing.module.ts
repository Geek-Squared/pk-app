import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';

const routes: Routes = [
  {
    path: '',

    canActivate: [AuthGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'home' },
      {
        path: 'home',
        loadChildren: () =>
          import('./pages/home/home.module').then((m) => m.HomePageModule),
      },
      {
        path: 'chapters',
        loadChildren: () =>
          import('./pages/chapters/chapters.module').then(
            (m) => m.ChaptersPageModule
          ),
      },
      {
        path: 'my-work-book',
        loadChildren: () =>
          import('./pages/my-work-book/my-work-book.module').then(
            (m) => m.MyWorkBookPageModule
          ),
      },
      {
        path: 'feedback',
        loadChildren: () =>
          import('./pages/feedback/feedback.module').then(
            (m) => m.FeedbackPageModule
          ),
      },
      {
        path: 'bookings',
        loadChildren: () =>
          import('./pages/bookings/bookings.module').then(
            (m) => m.BookingsPageModule
          ),
      },
      {
        path: 'messages',
        loadChildren: () =>
          import('./pages/messages/messages.module').then(
            (m) => m.MessagesPageModule
          ),
      },
      {
        path: 'notifications',
        loadChildren: () =>
          import('./pages/notifications/notifications.module').then(
            (m) => m.NotificationsPageModule
          ),
      },
      {
        path: 'ai-assistant',
        loadChildren: () =>
          import('./pages/ai-assistant/ai-assistant.module').then(
            (m) => m.AiAssistantPageModule
          ),
      },
      {
        path: 'posts/:chapterId',
        loadChildren: () =>
          import('./pages/posts/posts.module').then((m) => m.PostsPageModule),
      },
      {
        path: 'questions/:postId',
        loadChildren: () =>
          import('./pages/questions/questions.module').then(
            (m) => m.QuestionsPageModule
          ),
      },
      {
        path: 'about',
        loadChildren: () =>
          import('./pages/about/about.module').then(
            (m) => m.AboutPageModule)
      },
      {
        path: 'introduction',
        loadChildren: () => import('./pages/introduction/introduction.module').then( m => m.IntroductionPageModule)
      },
      {
        path: 'interventions',
        loadChildren: () => import('./pages/interventions/interventions.module').then( m => m.InterventionsPageModule)
      },
      {
        path: 'referrals',
        loadChildren: () => import('./pages/referrals/referrals.module').then( m => m.ReferralsPageModule)
      }
    ],
  },
  {
    path: 'registration',
    loadChildren: () =>
      import('./authentication/registration/registration.module').then(
        (m) => m.RegistrationPageModule
      ),
  },
  {
    path: 'login',
    loadChildren: () =>
      import('./authentication/login/login.module').then(
        (m) => m.LoginPageModule
      ),
  },
  {
    path: 'reset-password',
    loadChildren: () => import('./authentication/reset-password/reset-password.module').then( m => m.ResetPasswordPageModule)
  },
  {
    path: 'surveys',
    loadChildren: () => import('./pages/surveys/surveys.module').then( m => m.SurveysPageModule)
  }

];
@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
