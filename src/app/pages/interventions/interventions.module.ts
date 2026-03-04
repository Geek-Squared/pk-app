import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { BackButtonComponent } from 'src/app/components/back-button/back-button.component';
import { InterventionsPageRoutingModule } from './interventions-routing.module';
import { InterventionsPage } from './interventions.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    BackButtonComponent,
    InterventionsPageRoutingModule
  ],
  declarations: [InterventionsPage]
})
export class InterventionsPageModule {}
