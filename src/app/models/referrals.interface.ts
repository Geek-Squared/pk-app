export interface Referral {
    name: string;
    address: string;
    /**
     * The templates have always read `phoneNumber` while this interface
     * declared `phone`. With `strictTemplates` off, that mismatch compiled
     * silently and would render an empty number rather than fail. Both are
     * declared until the shape of the Firestore `referrals` documents is
     * confirmed; read them through `ReferralsPage.phoneOf()`, never directly.
     */
    phoneNumber?: string;
    phone?: string;
    id: string;
  }
