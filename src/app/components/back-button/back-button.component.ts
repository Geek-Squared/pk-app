import { Component, Input } from '@angular/core';
import { IonicModule, ModalController } from '@ionic/angular';
import { NavigationHistoryService } from 'src/app/services/navigation-history.service';

@Component({
  selector: 'app-back-button',
  standalone: true,
  imports: [IonicModule],
  template: `
    <ion-button fill="clear" size="small" class="back-button" (click)="handleBack()">
      <ion-icon name="chevron-back" slot="icon-only"></ion-icon>
    </ion-button>
  `,
  styles: [
    `
      .back-button {
        --background: transparent;
        --background-hover: transparent;
        --background-activated: transparent;
        --background-focused: transparent;
        --box-shadow: none;
      }
    `,
  ],
})
export class BackButtonComponent {
  @Input() fallbackUrl = '/home';

  constructor(
    private navHistory: NavigationHistoryService,
    private modalController: ModalController
  ) {}

  async handleBack(): Promise<void> {
    const topModal = await this.modalController.getTop();
    if (topModal) {
      await topModal.dismiss();
      return;
    }

    this.navHistory.back(this.fallbackUrl);
  }
}
