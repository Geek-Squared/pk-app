import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { ChatComponent } from './chat/chat.component';
import { VoiceNotesComponent } from './voice-notes/voice-notes.component';
import { ClientOnlyGuard } from 'src/app/guards/client-only.guard';

import { MessagesPage } from './messages.page';

const routes: Routes = [
  {
    path: '',
    component: MessagesPage,
  },
  {
    path: 'counsellors',
    component: MessagesPage,
    canActivate: [ClientOnlyGuard],
    data: { mode: 'counsellors' },
  },
  { path: 'chat/:chatId', component: ChatComponent },
  { path: 'voice-notes', component: VoiceNotesComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MessagesPageRoutingModule {}
