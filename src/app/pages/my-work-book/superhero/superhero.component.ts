import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import {
  HeroProfile,
  WorkbookDocument,
} from 'src/app/models/workbook.interface';
import { UtilitiesService } from 'src/app/services/utilities.service';
import { WorkbookService } from 'src/app/services/workbook.service';

interface PowerUpgrade {
  id: string;
  label: string;
  description: string;
  cost: number;
}

@Component({
  selector: 'app-superhero-chapter',
  templateUrl: './superhero.component.html',
  styleUrls: ['./superhero.component.scss'],
  standalone: false,
})
export class SuperheroComponent implements OnInit, OnDestroy {
  heroForm: FormGroup;
  coinBalance = 0;
  coinHistory: any[] = [];
  workbookId?: string;
  heroProfile: HeroProfile = {
    heroName: '',
    alias: '',
    auraColor: '#5b21b6',
    originStory: '',
    signaturePower: '',
    secondaryPowers: [],
    unlockedUpgrades: [],
    motto: '',
  };

  readonly auraOptions = [
    '#5b21b6',
    '#0f8a8e',
    '#dc2626',
    '#f59e0b',
    '#2563eb',
    '#1d4ed8',
  ];

  readonly secondaryPowerOptions = [
    'Compassion Pulse',
    'Calm Focus Field',
    'Mentor Beacon',
    'Guardian Shield',
    'Lightning Dash',
    'Healing Wave',
  ];

  readonly powerUpgrades: PowerUpgrade[] = [
    {
      id: 'radiant-barrier',
      label: 'Radiant Barrier',
      description:
        'Transforms setbacks into strength, shielding you from negative self-talk.',
      cost: 25,
    },
    {
      id: 'luna-beacon',
      label: 'Luna Beacon',
      description:
        'Call on Luna to reflect reminders from earlier workbook chapters.',
      cost: 30,
    },
    {
      id: 'heart-sprint',
      label: 'Heart Sprint',
      description:
        'Dash toward goals with courageous momentum when motivation dips.',
      cost: 20,
    },
    {
      id: 'healing-current',
      label: 'Healing Current',
      description:
        'Send ripples of calm breathing and mindfulness through the body.',
      cost: 35,
    },
  ];

  private readonly subscriptions = new Subscription();

  constructor(
    private readonly workbookService: WorkbookService,
    private readonly fb: FormBuilder,
    private readonly utilsService: UtilitiesService
  ) {
    this.heroForm = this.fb.group({
      heroName: ['', [Validators.required, Validators.minLength(3)]],
      alias: [''],
      originStory: ['', [Validators.required, Validators.minLength(40)]],
      signaturePower: ['', Validators.required],
      motto: [''],
      auraColor: [this.heroProfile.auraColor, Validators.required],
    });
  }

  ngOnInit(): void {
    const workbookSub = this.workbookService.getUserWorkbook().subscribe((doc) => {
      const workbook = doc?.[0] as WorkbookDocument | undefined;
      if (!workbook) {
        return;
      }

      this.workbookId = workbook.id;
      this.coinBalance = workbook.coinBalance ?? 0;
      this.coinHistory = (workbook.coinHistory ?? []).slice(-5).reverse();

      const profile: HeroProfile = {
        heroName: '',
        alias: '',
        auraColor: '#5b21b6',
        originStory: '',
        signaturePower: '',
        secondaryPowers: [],
        unlockedUpgrades: [],
        motto: '',
        ...(workbook.heroProfile ?? {}),
      };
      this.heroProfile = {
        ...this.heroProfile,
        ...profile,
        secondaryPowers: profile.secondaryPowers ?? [],
        unlockedUpgrades: profile.unlockedUpgrades ?? [],
      };

      this.heroForm.patchValue({
        heroName: this.heroProfile.heroName ?? '',
        alias: this.heroProfile.alias ?? '',
        originStory: this.heroProfile.originStory ?? '',
        signaturePower: this.heroProfile.signaturePower ?? '',
        motto: this.heroProfile.motto ?? '',
        auraColor: this.heroProfile.auraColor ?? this.heroProfile.auraColor,
      });
    });

    this.subscriptions.add(workbookSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  trackByLabel(_: number, label: string) {
    return label;
  }

  trackByUpgrade(_: number, upgrade: PowerUpgrade) {
    return upgrade.id;
  }

  isSecondarySelected(power: string): boolean {
    return this.heroProfile.secondaryPowers?.includes(power);
  }

  toggleSecondaryPower(power: string): void {
    const current = this.heroProfile.secondaryPowers ?? [];
    const updated = current.includes(power)
      ? current.filter((value) => value !== power)
      : [...current, power];

    this.heroProfile = {
      ...this.heroProfile,
      secondaryPowers: updated,
    };
  }

  selectAura(color: string): void {
    this.heroForm.patchValue({ auraColor: color });
  }

  saveHeroProfile(): void {
    if (!this.workbookId) {
      return;
    }

    if (this.heroForm.invalid) {
      this.heroForm.markAllAsTouched();
      this.utilsService.presentToast(
        'Please complete the hero story before saving.'
      );
      return;
    }

    const payload: HeroProfile = {
      heroName: this.heroForm.value.heroName.trim(),
      alias: this.heroForm.value.alias?.trim(),
      originStory: this.heroForm.value.originStory.trim(),
      signaturePower: this.heroForm.value.signaturePower,
      auraColor: this.heroForm.value.auraColor,
      motto: this.heroForm.value.motto?.trim(),
      secondaryPowers: this.heroProfile.secondaryPowers ?? [],
      unlockedUpgrades: this.heroProfile.unlockedUpgrades ?? [],
    };

    this.workbookService
      .updateHeroProfile(this.workbookId, payload)
      .then(() => this.utilsService.presentToast('Hero profile updated.'))
      .catch(() =>
        this.utilsService.presentToast(
          'Unable to save hero profile right now.'
        )
      );
  }

  unlockUpgrade(upgrade: PowerUpgrade): void {
    if (!this.workbookId) {
      return;
    }

    if (this.heroProfile.unlockedUpgrades?.includes(upgrade.id)) {
      return;
    }

    if (this.coinBalance < upgrade.cost) {
      this.utilsService.presentToast(
        'Earn more Luna coins to unlock this power.'
      );
      return;
    }

    this.workbookService
      .spendCoins(this.workbookId, upgrade.cost, `Unlocked ${upgrade.label}`, {
        upgradeId: upgrade.id,
      })
      .then(() => {
        const updatedProfile: HeroProfile = {
          ...this.heroProfile,
          unlockedUpgrades: [
            ...(this.heroProfile.unlockedUpgrades ?? []),
            upgrade.id,
          ],
        };

        this.heroProfile = updatedProfile;
        this.coinBalance -= upgrade.cost;
        return this.workbookService.updateHeroProfile(
          this.workbookId!,
          updatedProfile
        );
      })
      .then(() => {
        this.utilsService.presentToast(
          `${upgrade.label} added to your hero!`
        );
      })
      .catch(() =>
        this.utilsService.presentToast(
          'Unable to unlock this upgrade at the moment.'
        )
      );
  }
}
