export interface WorkbookResponse {
  uid: string;
  content: any;
  createdAt: number;
  postId?: string;
  chapterId?: string | null;
  qualityScore?: number | null;
  validationFeedback?: string;
  coinsAwarded?: number;
}

export interface CoinLedgerEntry {
  amount: number;
  reason: string;
  type: 'earn' | 'spend';
  timestamp: number;
  chapterId?: string | null;
  postId?: string | null;
  upgradeId?: string | null;
}

export interface HeroProfile {
  heroName: string;
  alias?: string;
  auraColor: string;
  emblem?: string;
  originStory: string;
  signaturePower?: string;
  secondaryPowers: string[];
  unlockedUpgrades: string[];
  motto?: string;
  updatedAt?: number;
}

export interface WorkbookResponseOptions {
  chapterId?: string | null;
  qualityScore?: number | null;
  validationFeedback?: string;
  coinsAwarded?: number;
  coinReason?: string;
}

export interface WorkbookDocument {
  id?: string;
  uid: string;
  createdAt: number;
  responses: WorkbookResponse[];
  coinBalance?: number;
  coinHistory?: CoinLedgerEntry[];
  heroProfile?: HeroProfile;
  count?: number;
}
