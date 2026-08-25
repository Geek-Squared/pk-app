export interface Intervention {
  name: string;
  createdDate: string;
  id: string;
  order?: number;

  // ---- Added by 002-onboarding-care-routing ----
  // All optional: an existing document carrying none of these is simply not
  // selectable at onboarding, and keeps working exactly as before.

  /** FR-005a. Whether this appears as a pill during onboarding. */
  selectableAtOnboarding?: boolean;
  /** Pill text. Falls back to `name`. */
  onboardingLabel?: string;
  /** Pill ordering. Falls back to `order`. */
  onboardingOrder?: number;
  /**
   * FR-005b. Drives which set is shown first, based on the member's stated age.
   * Absent means 'all'.
   */
  audience?: 'adolescent' | 'adult' | 'all';
}
