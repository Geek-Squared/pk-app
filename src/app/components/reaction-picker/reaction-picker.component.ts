import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { PopoverController } from '@ionic/angular';

@Component({
  selector: 'app-reaction-picker',
  template: `
    <div class="reaction-container">
      <div class="reaction-row">
        <span *ngFor="let emoji of reactions" (click)="pickReaction(emoji)">{{ emoji }}</span>
      </div>
    </div>
  `,
  styles: [`
    .reaction-container {
      background: white;
      padding: 8px 12px;
      border-radius: 30px;
    }
    .reaction-row {
      display: flex;
      gap: 12px;
      font-size: 1.6rem;
    }
    .reaction-row span {
      cursor: pointer;
      transition: transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .reaction-row span:active {
      transform: scale(1.5);
    }
    .reaction-row span:hover {
      transform: scale(1.2);
    }
  `],
  standalone: true,
  imports: [CommonModule]
})
export class ReactionPickerComponent {
  reactions = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

  constructor(private popoverCtrl: PopoverController) {}

  pickReaction(emoji: string) {
    this.popoverCtrl.dismiss(emoji);
  }
}
