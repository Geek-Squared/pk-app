import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { AiAssistantPage } from './ai-assistant.page';

const routes: Routes = [
  {
    path: '',
    component: AiAssistantPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AiAssistantPageRoutingModule {}

