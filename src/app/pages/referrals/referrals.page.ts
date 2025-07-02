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
