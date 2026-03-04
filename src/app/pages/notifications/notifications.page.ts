import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { UserNotificationsService } from 'src/app/services/user-notifications.service';

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.page.html',
  styleUrls: ['./notifications.page.scss'],
})
export class NotificationsPage implements OnInit, OnDestroy {
  notifications: any[] = [];
  isLoading = false;
  private uid: string | null = null;
  private sub?: Subscription;

  constructor(
    private notificationsService: UserNotificationsService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.uid = JSON.parse(localStorage.getItem('user'))?.uid || null;
    if (!this.uid) {
      return;
    }

    this.isLoading = true;
    this.sub = this.notificationsService
      .getUserNotifications(this.uid)
      .subscribe(
        (items: any[]) => {
          this.notifications = items || [];
          this.isLoading = false;
        },
        () => {
          this.isLoading = false;
        }
      );
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  openNotification(note: any): void {
    if (!note) {
      return;
    }

    if (this.uid && note?.id) {
      this.notificationsService.markAsRead(this.uid, note.id).catch(() => {});
    }

    const targetUrl = this.resolveTargetUrl(note);
    if (targetUrl) {
      this.router.navigateByUrl(targetUrl);
    }
  }

  resolveTargetUrl(note: any): string | null {
    const data = note?.data || {};
    if (data?.url) {
      return data.url;
    }
    if (data?.landing_page) {
      let target = data.landing_page;
      if (data?.chatId) {
        target = `${target}/${data.chatId}`;
      }
      if (!target.startsWith('/')) {
        target = `/${target}`;
      }
      return target;
    }
    return null;
  }
}
