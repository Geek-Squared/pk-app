/**
 * What one member told the programme during onboarding.
 *
 * Stored at `intakes/{uid}` — deliberately NOT on `users/{uid}`, which is read
 * by other members (chat and group-details fetch peers' user documents for
 * names, avatars and online state). Firestore has no field-level read control,
 * so demographics on that document would be visible to every peer in a group
 * chat. See specs/002-onboarding-care-routing/research.md R1.
 */

export type IntakeStatus = 'in_progress' | 'complete';

export interface IntakeConsent {
  /** Version of the demographic-processing notice the member agreed to. */
  demographicsVersion: string;
  demographicsAgreedAt: any; // Firestore Timestamp
  /**
   * Set when the member withdraws consent (FR-024). Withdrawal clears the three
   * demographic fields but must NOT cascade to the care assignment or workbook
   * history.
   */
  demographicsWithdrawnAt?: any | null;
}

export interface Intake {
  uid: string;

  /** FR-002. Distinct from `users.displayName`, which may be a pseudonym. */
  fullName: string;
  /** FR-002. Self-declared and unverified — there is no minimum age (FR-021). */
  age: number;
  /** FR-002. Contact only: not an auth factor, and no SMS verification. */
  phoneNumber: string;
  /** FR-003. Copied from the verified account, never retyped. */
  email: string;

  /** FR-020. These three are the ENTIRE demographic set. Do not add more. */
  gender: string;
  region: string;
  language: string;

  /** FR-005. May be empty — the default package then applies (FR-016). */
  selectedInterventionIds: string[];

  status: IntakeStatus;
  /** Resume point for User Story 2. */
  completedSteps: string[];
  consent: IntakeConsent;

  createdAt: any;
  updatedAt: any;
  completedAt?: any;

  // ---------------------------------------------------------------------
  // There is deliberately NO free-text field here, and no HIV-status field.
  //
  // FR-006: intake collects no free-text account of the member's situation.
  //   Once the care package became pure self-selection, such a field would
  //   collect sensitive disclosure that changes nothing while implying it does.
  // FR-025: completing intake must never require disclosing HIV status.
  //
  // Their absence IS the requirement. Adding either is a spec violation, not
  // an enhancement. `tests/contracts/no-sensitive-fields.spec.ts` enforces this.
  // ---------------------------------------------------------------------
}
