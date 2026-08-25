/**
 * A member's package of care, stored at `careAssignments/{uid}`.
 *
 * Stored rather than derived from `intakes/{uid}.selectedInterventionIds`,
 * because a staff override is by definition a package that disagrees with the
 * member's own selection, which a derived value cannot represent (FR-030).
 * See specs/002-onboarding-care-routing/research.md R2.
 */

export type CareAssignmentSource = 'self_selection' | 'default' | 'staff_override';

export interface CareAssignment {
  uid: string;

  /** The package. Never empty — the default applies if selections were (FR-016). */
  interventionIds: string[];

  /** FR-013: how this assignment arose. */
  source: CareAssignmentSource;

  /** Staff uid, when `source` is 'staff_override' (FR-029). */
  overriddenBy?: string | null;
  overrideReason?: string | null;

  effectiveAt: any;
  updatedAt: any;
}

/**
 * A superseded assignment, copied to `careAssignments/{uid}/history/{autoId}`
 * before the parent is overwritten. Append-only: never updated or deleted.
 */
export interface CareAssignmentHistoryEntry extends CareAssignment {
  supersededAt: any;
}
