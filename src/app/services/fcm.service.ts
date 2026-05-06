import { Injectable, NgZone } from '@angular/core';

import { Capacitor } from '@capacitor/core';
import { Router } from '@angular/router';
import { UsersService } from './users.service';
import { ToastController } from '@ionic/angular';
import { InAppNotificationsService } from './in-app-notifications.service';
import { environment } from 'src/environments/environment';
import { getApps, initializeApp } from 'firebase/app';
import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  Messaging,
} from 'firebase/messaging';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';

@Injectable({
  providedIn: 'root',
})
export class FcmService {
  private webInitPromise: Promise<void> | null = null;
  private webMessaging: Messaging | null = null;
  private swMessageListenerAttached = false;
  private nativeInitPromise: Promise<void> | null = null;

  constructor(
    private router: Router,
    private usersService: UsersService,
    private zone: NgZone,
    private toastController: ToastController,
    private inAppNotifications: InAppNotificationsService
  ) {}

  initPush() {
    if (Capacitor.getPlatform() !== 'web') {
      this.initNativePush();
      return;
    }
    this.initWebPush();
  }

  private initNativePush(): void {
    if (this.nativeInitPromise) {
      return;
    }
    this.nativeInitPromise = this.registerNativePush();
  }

  private async registerNativePush(): Promise<void> {
    const uid = JSON.parse(localStorage.getItem('user'))?.uid;
    if (!uid) {
      return;
    }

    const permStatus = await FirebaseMessaging.checkPermissions().catch(() => ({
      receive: 'prompt',
    }));
    console.log('[FirebaseMessaging] checkPermissions', permStatus);
    if (permStatus.receive !== 'granted') {
      const requested = await FirebaseMessaging.requestPermissions().catch(
        () => ({ receive: 'denied' })
      );
      console.log('[FirebaseMessaging] requestPermissions', requested);
      if (requested.receive !== 'granted') {
        return;
      }
    }

    // Ensure Android has a proper high-importance channel.
    await FirebaseMessaging.createChannel({
      id: 'pk_chat',
      name: 'Chat messages',
      description: 'Incoming chat messages',
      importance: 5,
      visibility: 1,
      sound: 'default',
      lights: true,
      vibration: true,
    }).catch(() => undefined);
    const channels = await FirebaseMessaging.listChannels().catch(() => null);
    if (channels) {
      console.log('[FirebaseMessaging] channels', channels);
    }

    const tokenResult = await FirebaseMessaging.getToken().catch(() => null);
    if (tokenResult?.token) {
      await this.usersService.updateDeviceId(uid, tokenResult.token);
      console.log('Native FCM token registered for user', uid);
    }

    await FirebaseMessaging.addListener('tokenReceived', async (event) => {
      const token = event?.token;
      if (token) {
        await this.usersService.updateDeviceId(uid, token);
      }
    });

    await FirebaseMessaging.addListener('notificationReceived', (event: any) => {
      this.zone.run(() => {
        const title = event?.notification?.title || 'Positive Konnections';
        const body = event?.notification?.body || '';
        const targetUrl = this.resolveLandingUrl(event?.data || {});

        this.inAppNotifications.markUnread({
          title,
          body,
          createdAt: Date.now(),
          targetUrl,
          data: event?.data || {},
        });

        // No custom in-app banner on mobile; rely on OS notification UI.
      });
    });

    await FirebaseMessaging.addListener(
      'notificationActionPerformed',
      (event: any) => {
        this.zone.run(() => {
          const data = event?.notification?.data || event?.data || {};
          const targetUrl = this.resolveLandingUrl(data);
          if (targetUrl) {
            this.inAppNotifications.clearUnread();
            this.router.navigateByUrl(targetUrl);
          }
        });
      }
    );

    await FirebaseMessaging.subscribeToTopic({ topic: 'groupChat' }).catch(
      () => undefined
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
      console.log('Web FCM token registered for user', uid);
    }

    this.attachServiceWorkerMessageListener();

    onMessage(this.webMessaging, (payload) => {
      this.zone.run(() => {
        const title =
          payload?.notification?.title || 'Positive Konnections';
        const body = payload?.notification?.body || '';

        this.handleIncomingWebMessage(payload);
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

  private async presentInAppBanner(
    title: string,
    body: string,
    targetUrl: string | null
  ): Promise<void> {
    try {
      const toast = await this.toastController.create({
        header: title,
        message: body,
        duration: 5000,
        position: 'top',
        cssClass: 'pk-native-banner',
        buttons: [
          {
            text: 'Open',
            role: 'cancel',
            handler: () => {
              if (targetUrl) {
                this.router.navigateByUrl(targetUrl);
                this.inAppNotifications.clearUnread();
              }
            },
          },
        ],
      });

      await toast.present();
    } catch (err) {
      console.warn('Unable to present in-app banner', err);
    }
  }

  private attachServiceWorkerMessageListener(): void {
    if (this.swMessageListenerAttached) {
      return;
    }
    this.swMessageListenerAttached = true;

    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    navigator.serviceWorker.addEventListener('message', (event: any) => {
      const data = event?.data;
      if (!data || data.type !== 'fcm_background') {
        return;
      }

      // Forward background-push payloads into the same handler used for foreground pushes.
      this.zone.run(() => {
        this.handleIncomingWebMessage(data.payload);
      });
    });
  }

  private handleIncomingWebMessage(payload: any): void {
    const title = payload?.notification?.title || 'Positive Konnections';
    const body = payload?.notification?.body || '';
    const targetUrl = this.resolveLandingUrl(payload?.data || {});

    this.inAppNotifications.markUnread({
      title,
      body,
      createdAt: Date.now(),
      targetUrl,
      data: payload?.data || {},
    });

    // Show a toast banner when the app is running.
    this.presentInAppBanner(title, body, targetUrl);
  }

  public async unsubscribeFromTopic() {
    await FirebaseMessaging.unsubscribeFromTopic({ topic: 'groupChat' }).catch(
      () => undefined
    );
  }
}
