import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ReferralsPage } from './referrals.page';

const routes: Routes = [
  {
    path: '',
    component: ReferralsPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ReferralsPageRoutingModule {}
