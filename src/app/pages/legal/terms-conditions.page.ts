import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowBack } from 'ionicons/icons';

@Component({
  selector: 'app-terms-conditions',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './terms-conditions.page.html',
  styleUrls: ['./legal.scss'],
})
export class TermsConditionsPage {
  constructor(private location: Location) {
    addIcons({ arrowBack });
  }
  goBack(): void {
    this.location.back();
  }
}
