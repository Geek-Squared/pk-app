import { Injectable, NgZone } from '@angular/core';

import { Capacitor } from '@capacitor/core';
import {
  ActionPerformed,
  PushNotifications,
  PushNotificationSchema,
} from '@capacitor/push-notifications';
import { Router } from '@angular/router';
import { UsersService } from './users.service';
import { FCM } from '@capacitor-community/fcm';
import { environment } from 'src/environments/environment';
import { getApps, initializeApp } from 'firebase/app';
import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  Messaging,
} from 'firebase/messaging';

@Injectable({
  providedIn: 'root',
})
export class FcmService {
  private webInitPromise: Promise<void> | null = null;
  private webMessaging: Messaging | null = null;

  constructor(
    private router: Router,
    private usersService: UsersService,
    private zone: NgZone
  ) {}

  initPush() {
    if (Capacitor.getPlatform() !== 'web') {
      this.registerPush();
      this.subscribeToTopic();
      return;
    }
    this.initWebPush();
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

  private initWebPush(): void {
    if (this.webInitPromise) {
      return;
    }

    this.webInitPromise = this.registerWebPush();
  }

  private async registerWebPush(): Promise<void> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    const supported = await isSupported().catch(() => false);
    if (!supported) {
      return;
    }

    if (!getApps().length) {
      initializeApp(environment.firebaseConfig);
    }

    this.webMessaging = getMessaging();

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return;
    }

    if (
      !environment.fcmVapidKey ||
      environment.fcmVapidKey.startsWith('REPLACE_')
    ) {
      console.warn('FCM VAPID key is not configured.');
      return;
    }

    let registration: ServiceWorkerRegistration | undefined;
    if ('serviceWorker' in navigator) {
      registration = await navigator.serviceWorker.register(
        '/firebase-messaging-sw.js'
      );
    }

    const token = await getToken(this.webMessaging, {
      vapidKey: environment.fcmVapidKey,
      serviceWorkerRegistration: registration,
    }).catch((error) => {
      console.warn('Unable to get FCM token', error);
      return null;
    });

    const uid = JSON.parse(localStorage.getItem('user'))?.uid;
    if (token && uid) {
      await this.usersService.updateWebFcmToken(uid, token);
    }

    onMessage(this.webMessaging, (payload) => {
      this.zone.run(() => {
        const title =
          payload?.notification?.title || 'Positive Konnections';
        const body = payload?.notification?.body || '';
        if ('Notification' in window && Notification.permission === 'granted') {
          const notification = new Notification(title, {
            body,
            data: payload?.data || {},
          });
          notification.onclick = () => {
            const targetUrl = this.resolveLandingUrl(payload?.data || {});
            if (targetUrl) {
              this.router.navigateByUrl(targetUrl);
            }
            notification.close();
          };
        }
      });
    });
  }

  private resolveLandingUrl(data: any): string | null {
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
