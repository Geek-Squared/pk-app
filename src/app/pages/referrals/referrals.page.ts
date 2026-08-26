import { Component, OnInit } from '@angular/core';
import { Referral } from 'src/app/models/referrals.interface';
import { ReferralsService } from 'src/app/services/referrals.service';


@Component({
  selector: 'app-referrals',
  templateUrl: './referrals.page.html',
  styleUrls: ['./referrals.page.scss'],
  standalone: false
})
export class ReferralsPage implements OnInit {

  public referrals: Referral[];
  public isLoading: boolean;

  constructor(private referralsService: ReferralsService) { }

  /**
   * Firestore documents disagree with the model on the field name, so read
   * whichever is actually populated. Returns '' when there is no number,
   * which is what the call affordance keys off.
   */
  phoneOf(referral: Referral): string {
    return (referral?.phoneNumber || referral?.phone || '').trim();
  }

  /**
   * Dial via a `tel:` URI. Capacitor's WebView turns non-http schemes into an
   * Android intent, so this opens the dialer natively and hands off to the OS
   * on the web — no plugin needed.
   */
  call(referral: Referral): void {
    const dialable = this.toDialable(this.phoneOf(referral));
    if (!dialable) {
      return;
    }
    window.location.href = `tel:${dialable}`;
  }

  /**
   * Keep digits, and a leading + for international numbers. Spaces, dashes and
   * brackets are common in the stored values and confuse some dialers.
   */
  private toDialable(raw: string): string {
    if (!raw) {
      return '';
    }
    const plus = raw.trim().startsWith('+') ? '+' : '';
    const digits = raw.replace(/\D/g, '');
    return digits ? `${plus}${digits}` : '';
  }

  ngOnInit() {
    this.isLoading = true;
    this.referralsService.getReferrals().subscribe(
      (data) => {
        this.referrals = data.map((e: any) => {
          return {
            id: e.payload.doc.id,
            ...e.payload.doc.data(),
          } as Referral;
        });
        this.isLoading = false;
        // console.log(this.referrals);
      },
      () => {
        this.isLoading = false;
      }
    );
  }

}
