import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { ToastController } from '@ionic/angular';
import { environment } from 'src/environments/environment';

export interface SharePayload {
  title?: string;
  text?: string;
  url?: string;
}

/** What actually happened, so callers can react (or not) without try/catch. */
export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'unavailable';

@Injectable({ providedIn: 'root' })
export class ShareService {
  constructor(private toastCtrl: ToastController) {}

  /** Share the app itself — the "Share App" / invite-a-friend action. */
  shareApp(): Promise<ShareOutcome> {
    return this.share(environment.share);
  }

  /**
   * Three tiers, because no single API covers every platform we ship to:
   *   native   -> @capacitor/share (Android system share sheet)
   *   web      -> navigator.share, where the browser supports it
   *   fallback -> copy the link to the clipboard and say so
   *
   * The fallback matters more than it looks: navigator.share is a Chrome-on-
   * Android API and is NOT implemented in the Android System WebView, so a
   * web build opened in an embedded WebView lands here rather than on tier 2.
   */
  async share(payload: SharePayload): Promise<ShareOutcome> {
    const { title, text, url } = payload;

    if (Capacitor.isNativePlatform()) {
      try {
        await Share.share({ title, text, url, dialogTitle: title });
        return 'shared';
      } catch (err) {
        if (this.isCancellation(err)) {
          return 'cancelled';
        }
        // Fall through — a failed sheet is still better than a dead button.
      }
    } else if (this.canUseWebShare()) {
      try {
        await navigator.share({ title, text, url });
        return 'shared';
      } catch (err) {
        if (this.isCancellation(err)) {
          return 'cancelled';
        }
      }
    }

    return this.copyToClipboard(url);
  }

  private canUseWebShare(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  }

  /**
   * Dismissing the share sheet is a normal outcome, not a failure. Capacitor
   * reports it as a "canceled"/"cancelled" message; the web API throws
   * AbortError. Either way the user should not see an error toast.
   */
  private isCancellation(err: any): boolean {
    if (!err) {
      return false;
    }
    if (err.name === 'AbortError') {
      return true;
    }
    const message = String(err.message ?? err).toLowerCase();
    return message.includes('cancel') || message.includes('abort');
  }

  private async copyToClipboard(url?: string): Promise<ShareOutcome> {
    if (!url) {
      return 'unavailable';
    }
    try {
      await navigator.clipboard.writeText(url);
      await this.toast('Link copied to clipboard');
      return 'copied';
    } catch {
      // Clipboard access can be refused outright (insecure origin, no
      // permission). Show the link so it can still be copied by hand.
      await this.toast(url, 5000);
      return 'unavailable';
    }
  }

  private async toast(message: string, duration = 2000): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration,
      position: 'bottom',
    });
    await toast.present();
  }
}
