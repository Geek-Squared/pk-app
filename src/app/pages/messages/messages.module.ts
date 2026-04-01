import { BackButtonComponent } from 'src/app/components/back-button/back-button.component';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { MessagesPageRoutingModule } from './messages-routing.module';

import { ChatComponent } from './chat/chat.component';
import { VoiceNotesComponent } from './voice-notes/voice-notes.component';

@NgModule({
  imports: [
    CommonModule, 
    FormsModule, 
    IonicModule,
    BackButtonComponent, 
    MessagesPageRoutingModule,
    VoiceNotesComponent
  ],
})
export class MessagesPageModule {}
