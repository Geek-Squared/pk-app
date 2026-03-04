import { Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class NavigationHistoryService {
  private readonly history: string[] = [];

  constructor(private router: Router) {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => {
        const nav = event as NavigationEnd;
        const url = nav.urlAfterRedirects;
        const last = this.history[this.history.length - 1];
        if (last !== url) {
          this.history.push(url);
        }
        if (this.history.length > 50) {
          this.history.shift();
        }
      });
  }

  back(fallbackUrl: string): void {
    if (this.history.length < 2) {
      this.router.navigateByUrl(fallbackUrl);
      return;
    }

    // Remove current URL
    this.history.pop();
    const target = this.history.pop();

    if (target) {
      this.router.navigateByUrl(target);
      return;
    }

    this.router.navigateByUrl(fallbackUrl);
  }
}
