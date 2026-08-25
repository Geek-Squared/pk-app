import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowBack } from 'ionicons/icons';

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './privacy-policy.page.html',
  styleUrls: ['./legal.scss'],
})
export class PrivacyPolicyPage {
  constructor(private location: Location) {
    addIcons({ arrowBack });
  }
  goBack(): void {
    this.location.back();
  }
}
