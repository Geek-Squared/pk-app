import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-emoji-picker',
  template: `
    <div class="emoji-container">
      <div class="emoji-grid">
        <span *ngFor="let emoji of emojis" (click)="pickEmoji(emoji)">{{ emoji }}</span>
      </div>
    </div>
  `,
  styles: [`
    .emoji-container {
      padding: 20px;
      padding-bottom: 40px;
      max-height: 100%;
      overflow-y: auto;
      background: white;
    }
    .emoji-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 16px;
      font-size: 1.8rem;
      text-align: center;
    }
    .emoji-grid span {
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 5px;
      transition: transform 0.1s;
    }
    .emoji-grid span:active {
      transform: scale(1.4);
    }
  `],
  standalone: true,
  imports: [CommonModule]
})
export class EmojiPickerComponent {
  // Same emojis as before
  emojis = [
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
    '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
    '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
    '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
    '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬',
    '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗',
    '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯',
    '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐',
    '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈',
    '👿', '👹', '👺', '🤡', '👻', '💀', '☠️', '👽', '👾', '🤖',
    '💩', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾',
    '💋', '👋', '🤚', '🖐', '✋', '🖖', '👌', '🤏', '✌️', '🤞',
    '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍',
    '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝',
    '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦵', '🦿', '🦶', '👂',
    '🦻', '👃', '🧠', '🦷', '🦴', '👀', '👁', '👅', '👄'
  ];

  constructor(private modalCtrl: ModalController) {}

  pickEmoji(emoji: string) {
    this.modalCtrl.dismiss(emoji);
  }
}
