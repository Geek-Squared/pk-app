import { Component } from '@angular/core';

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.page.html',
  styleUrls: ['./notifications.page.scss'],
})
export class NotificationsPage {
  notifications = [
    {
      title: 'Daily check-in reminder',
      body: 'Spend a moment reflecting on how you feel today.',
      time: 'Just now',
    },
    {
      title: 'Workbook entry nudged',
      body: 'Add your thoughts to your workbook to stay on track.',
      time: '2h ago',
    },
    {
      title: 'New message',
      body: 'Your coach left you feedback in Messages.',
      time: 'Yesterday',
    },
  ];
}

