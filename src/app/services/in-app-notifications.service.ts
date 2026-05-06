import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface InAppNotification {
  title: string;
  body: string;
  createdAt: number;
  targetUrl: string | null;
  data?: any;
}

@Injectable({
  providedIn: 'root',
})
export class InAppNotificationsService {
  private readonly unread$ = new BehaviorSubject<boolean>(false);
  private readonly lastNotification$ = new BehaviorSubject<InAppNotification | null>(null);

  get hasUnread$(): Observable<boolean> {
    return this.unread$.asObservable();
  }

  get last$(): Observable<InAppNotification | null> {
    return this.lastNotification$.asObservable();
  }

  markUnread(notification: InAppNotification): void {
    this.lastNotification$.next(notification);
    this.unread$.next(true);
  }

  clearUnread(): void {
    this.unread$.next(false);
  }
}

