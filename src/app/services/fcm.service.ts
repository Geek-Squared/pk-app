import { Injectable } from '@angular/core';

import { Capacitor } from '@capacitor/core';
import {
  ActionPerformed,
  PushNotifications,
  PushNotificationSchema,
} from '@capacitor/push-notifications';
import { Router } from '@angular/router';
import { UsersService } from './users.service';
import { FCM } from '@capacitor-community/fcm';

@Injectable({
  providedIn: 'root',
})
export class FcmService {
  constructor(private router: Router, private usersService: UsersService) {}

  initPush() {
    if (Capacitor.getPlatform() !== 'web') {
      this.registerPush();
      this.subscribeToTopic();
    }
  }

  private async registerPush() {
    const uid = JSON.parse(localStorage.getItem('user'))?.uid;
    PushNotifications.requestPermissions().then((permission) => {
      if (permission.receive === 'granted') {
        // Register with Apple / Google to receive push via APNS/FCM
        PushNotifications.register();
      } else {
        // No permission for push granted
      }
    });

    PushNotifications.addListener('registration', (token: any) => {
      this.usersService
        .updateDeviceId(uid, token)
        .then(() => {
          console.log('updated device id');
        })
        .catch((err) => {
          console.error('err =>', err);
        });
    });

    PushNotifications.addListener('registrationError', (error: any) => {
      console.log('Error: ' + JSON.stringify(error));
    });

    PushNotifications.addListener(
      'pushNotificationReceived',
      (notification: PushNotificationSchema) => {
        console.log('Push received: ' + JSON.stringify(notification));
      }
    );

    PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (notification: ActionPerformed) => {
        const data = notification.notification.data;

        console.log(
          'Action performed: ' + JSON.stringify(notification.notification)
        );
        this.router.navigateByUrl(`/messages/chat/${data?.chatId}`);
      }
    );
  }

  public async subscribeToTopic() {
    await PushNotifications.requestPermissions();
    await PushNotifications.register();
    FCM.subscribeTo({ topic: 'groupChat' })
      .then((r) => {})
      .catch((err) => console.log(err));
  }

  public unsubscribeFromTopic() {
    FCM.unsubscribeFrom({ topic: 'test' })
      .then(() => {})
      .catch((err) => console.log(err));
  }
}
