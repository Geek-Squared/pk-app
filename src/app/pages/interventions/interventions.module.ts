import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { InterventionsPageRoutingModule } from './interventions-routing.module';
import { InterventionsPage } from './interventions.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    InterventionsPageRoutingModule
  ],
  declarations: [InterventionsPage]
})
export class InterventionsPageModule {}
