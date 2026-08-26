import { describe, it, expect } from 'vitest';
import { toE164, isZimbabweanMobile } from '../../functions/src/phone';

/**
 * FR-004 (one canonical form) and FR-016 (Zimbabwe only), asserted for both
 * what they accept and what they reject — the same discipline the rules suite
 * follows. A canonicaliser tested only on valid input is untested: its whole
 * job is deciding what does not belong.
 */

const CANONICAL = '+263771234567';

describe('toE164 — the same number, however it is written', () => {
  it.each([
    ['+263771234567', 'already canonical'],
    ['263771234567', 'country code, no plus'],
    ['0771234567', 'national trunk prefix'],
    ['771234567', 'bare national number'],
    ['+263 77 123 4567', 'spaces'],
    ['263-77-123-4567', 'dashes'],
    ['(0)77 123 4567', 'parentheses'],
    ['  0771234567  ', 'surrounding whitespace'],
  ])('%s (%s) resolves to the canonical form', (input) => {
    expect(toE164(input)).toBe(CANONICAL);
  });

  it('accepts every Zimbabwean mobile prefix', () => {
    // 71 NetOne, 73 Telecel, 77 and 78 Econet.
    expect(toE164('0711234567')).toBe('+263711234567');
    expect(toE164('0731234567')).toBe('+263731234567');
    expect(toE164('0771234567')).toBe('+263771234567');
    expect(toE164('0781234567')).toBe('+263781234567');
  });
});

describe('toE164 — what it refuses to send an SMS to', () => {
  it('rejects a Zimbabwean landline', () => {
    // Harare landline: 9 digits but starts with 2, not 7.
    expect(toE164('0242751234')).toBeNull();
  });

  it.each([
    ['+447700900123', 'United Kingdom'],
    ['+12025550143', 'United States'],
    ['+27821234567', 'South Africa — neighbouring, still not ours'],
  ])('rejects %s (%s)', (input) => {
    expect(toE164(input)).toBeNull();
  });

  it.each([
    ['077123456', 'one digit short'],
    ['07712345678', 'one digit long'],
    ['', 'empty'],
    ['   ', 'whitespace only'],
    ['not a number', 'letters'],
    ['+263', 'country code alone'],
  ])('rejects %s (%s)', (input) => {
    expect(toE164(input)).toBeNull();
  });

  it.each([[null], [undefined], [12345], [{}], [[]]])(
    'rejects the non-string %s',
    (input) => {
      expect(toE164(input)).toBeNull();
    }
  );
});

describe('canonicalisation is stable', () => {
  it('is idempotent — canonicalising twice changes nothing', () => {
    expect(toE164(toE164('0771234567'))).toBe(CANONICAL);
  });

  it('collapses every spelling to one document id', () => {
    const spellings = [
      '+263771234567',
      '263771234567',
      '0771234567',
      '771234567',
      '+263 77 123 4567',
    ];
    expect(new Set(spellings.map(toE164)).size).toBe(1);
  });
});

describe('isZimbabweanMobile', () => {
  it('agrees with toE164', () => {
    expect(isZimbabweanMobile('0771234567')).toBe(true);
    expect(isZimbabweanMobile('+447700900123')).toBe(false);
  });
});
