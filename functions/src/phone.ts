/**
 * Zimbabwean mobile numbers, in one canonical form.
 *
 * The same person writes their number as 0771234567, 771234567,
 * +263 77 123 4567 or 263-77-123-4567. All of those must resolve to one
 * value, or one person becomes two accounts with two workbooks.
 *
 * Canonical form is `+263` followed by nine digits beginning with 7 — the
 * Zimbabwean mobile national significant number (71 NetOne, 73 Telecel,
 * 77/78 Econet).
 *
 * Anything else is rejected HERE, at the earliest point, rather than later:
 * a number that cannot be canonicalised never reaches an SMS send, so it
 * cannot cost anything. That makes this function part of the FR-016
 * Zimbabwe-only control, not merely input tidying.
 *
 * Deliberately free of any Firebase import so it can be tested on its own.
 */

/** `+263` plus nine digits starting with 7. */
const CANONICAL = /^\+2637\d{8}$/;

/**
 * Canonicalises a Zimbabwean mobile number, or returns null if it is not one.
 *
 * Null covers every rejection — landlines, other countries, malformed input —
 * because the caller's response to all of them is identical: do not send an
 * SMS. Distinguishing them would imply the person could fix a landline by
 * retyping it.
 */
export function toE164(input: unknown): string | null {
  if (typeof input !== 'string') {
    return null;
  }

  // Strip everything a person might type as punctuation, keeping a leading +.
  const trimmed = input.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');

  if (!digits) {
    return null;
  }

  let national: string;

  if (digits.startsWith('263')) {
    // +263771234567 / 263771234567
    national = digits.slice(3);
  } else if (hasPlus) {
    // An explicit + with any other country code is not ours to send to.
    return null;
  } else if (digits.startsWith('0')) {
    // 0771234567 — national trunk prefix
    national = digits.slice(1);
  } else {
    // 771234567 — bare national significant number
    national = digits;
  }

  const candidate = `+263${national}`;
  return CANONICAL.test(candidate) ? candidate : null;
}

/** Convenience for call sites that only need a yes/no. */
export function isZimbabweanMobile(input: unknown): boolean {
  return toE164(input) !== null;
}
