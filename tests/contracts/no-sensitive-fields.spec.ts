import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Enforces two NEGATIVE requirements, whose whole content is that something
 * must not exist. Nothing else in the codebase can enforce them: a field that
 * is absent leaves no artifact to assert against, so without this test the
 * requirements are only comments.
 *
 *   FR-006  Intake collects no free-text account of the member's situation.
 *   FR-025  Completing intake must never require disclosing HIV status.
 *
 * Both are easy to reintroduce by accident — a "tell us more" textarea, or a
 * status dropdown added for reporting — which is exactly why this guard exists.
 */

const ROOT = join(__dirname, '..', '..');

function collect(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collect(full, out);
    else if (/\.(ts|html)$/.test(entry) && !entry.endsWith('.spec.ts')) out.push(full);
  }
  return out;
}

/** Files that make up the intake surface. */
function intakeFiles(): string[] {
  return [
    ...collect(join(ROOT, 'src/app/pages/onboarding')),
    join(ROOT, 'src/app/models/intake.interface.ts'),
    join(ROOT, 'src/app/services/intake.service.ts'),
  ].filter(existsSync);
}

/** Strip comments so the requirement's own explanation does not trip the guard. */
function code(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/<!--[\s\S]*?-->/g, '');
}

describe('intake collects no sensitive disclosure', () => {
  it('FR-025: no HIV-status field anywhere on the intake surface', () => {
    const offenders = intakeFiles().filter((f) =>
      /\bhiv\b|hivStatus|serostatus|viral[_ ]?load|cd4/i.test(code(f))
    );
    expect(offenders, `HIV-status collection found in:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('FR-006: no free-text situation field on the intake surface', () => {
    const offenders = intakeFiles().filter((f) =>
      /<textarea|ion-textarea|whatAreYouGoingThrough|situationText|freeText/i.test(code(f))
    );
    expect(offenders, `Free-text intake field found in:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('guard is wired to real files once the intake pages exist', () => {
    // Until Phase 3 builds src/app/pages/onboarding, only the model exists.
    // This keeps the guard honest: it must never silently pass over nothing.
    expect(intakeFiles().length).toBeGreaterThan(0);
  });
});
