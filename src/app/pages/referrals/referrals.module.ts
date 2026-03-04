import { BackButtonComponent } from 'src/app/components/back-button/back-button.component';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ReferralsPageRoutingModule } from './referrals-routing.module';

import { ReferralsPage } from './referrals.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    BackButtonComponent,
    ReferralsPageRoutingModule
  ],
  declarations: [ReferralsPage]
})
export class ReferralsPageModule {}
