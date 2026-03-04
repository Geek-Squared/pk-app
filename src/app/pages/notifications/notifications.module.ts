import { IonicModule } from '@ionic/angular';
import { BackButtonComponent } from 'src/app/components/back-button/back-button.component';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { NotificationsPage } from './notifications.page';
import { NotificationsPageRoutingModule } from './notifications-routing.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule,
    BackButtonComponent, NotificationsPageRoutingModule],
  declarations: [NotificationsPage],
})
export class NotificationsPageModule {}

