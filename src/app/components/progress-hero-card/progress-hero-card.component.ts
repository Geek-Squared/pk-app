import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-progress-hero-card',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './progress-hero-card.component.html',
  styleUrls: ['./progress-hero-card.component.scss'],
})
export class ProgressHeroCardComponent {
  @Input() statusLabel = 'Status: Active';
  @Input() title = 'Your Progress Journey';
  @Input() icon = 'auto_graph';
  @Input() percentage = 0;
  @Input() completedCount = 0;
  @Input() totalCount = 0;
  @Input() itemLabel = 'Modules Completed';
  @Input() actionLabel = '';

  @Output() action = new EventEmitter<void>();

  get normalizedPercentage(): number {
    if (!Number.isFinite(this.percentage)) {
      return 0;
    }
    return Math.max(0, Math.min(100, Math.round(this.percentage)));
  }
}
