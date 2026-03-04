import { BackButtonComponent } from 'src/app/components/back-button/back-button.component';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ChaptersPageRoutingModule } from './chapters-routing.module';

import { ChaptersPage } from './chapters.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    BackButtonComponent,
    ChaptersPageRoutingModule
  ],
  declarations: [ChaptersPage]
})
export class ChaptersPageModule {}
