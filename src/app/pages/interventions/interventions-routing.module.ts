import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { InterventionsPage } from './interventions.page';

const routes: Routes = [
  {
    path: '',
    component: InterventionsPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class InterventionsPageRoutingModule {}
