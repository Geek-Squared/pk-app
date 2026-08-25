export interface Intervention {
  name: string;
  createdDate: string;
  id: string;
  order?: number;

  // Present on the live documents but never declared here until now — found by
  // exporting a real document (research R7, task T006). Optional because both
  // were empty strings in every document sampled.
  uid?: string;
  /**
   * The intervention's category. Confirm whether this is populated before
   * relying on `audience` below — it may already express what FR-005b needs.
   */
  categoryId?: string;

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

  /**
   * Measurement surveys for this intervention, by timepoint. Arrays rather than
   * single ids so an intervention can administer several instruments at a
   * point, and so the SAME instrument can repeat across timepoints — which is
   * the whole basis of measuring change.
   */
  surveys?: InterventionSurveys;
}

export type SurveyTimepoint = 'baseline' | 'midline' | 'endline';

export interface InterventionSurveys {
  baseline?: string[];
  midline?: string[];
  endline?: string[];
}
