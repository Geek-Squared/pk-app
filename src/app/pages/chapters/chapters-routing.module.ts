import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ChaptersPage } from './chapters.page';

const routes: Routes = [
  {
    path: ':interventionId',
    component: ChaptersPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ChaptersPageRoutingModule {}
