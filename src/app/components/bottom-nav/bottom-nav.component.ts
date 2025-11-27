import { Component } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule],
  templateUrl: './bottom-nav.component.html',
  styleUrls: ['./bottom-nav.component.scss'],
})
export class BottomNavComponent {
  private readonly hiddenRoutes = ['/login', '/registration', '/reset-password'];
  show = true;

  constructor(private router: Router) {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.evaluateVisibility());
    this.evaluateVisibility();
  }

  isActive(path: string): boolean {
    const current = this.router.url.split('?')[0];
    return current === path || current.startsWith(path + '/');
  }

  private evaluateVisibility(): void {
    const current = this.router.url.split('?')[0];
    this.show = !this.hiddenRoutes.some((route) => current.startsWith(route));
  }
}
