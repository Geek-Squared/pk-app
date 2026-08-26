import { initializeTestEnvironment, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDocFromServer } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The guard decides on a SERVER read of intakes/{uid}. This proves the rules
 * permit that exact read, and that the member sees their own status.
 *
 * The bug this covers: the guard used to read users/{uid}.onboardingStatus.
 * The app writes isOnline to that document at startup, so on a cold load
 * Firestore served a local document containing only the just-written field —
 * status absent, guard redirects, onboarding page bounces back. A flash of the
 * onboarding screen on every refresh. intakes/{uid} is untouched at boot.
 */
describe('the read the OnboardingGuard performs', () => {
  let env: RulesTestEnvironment;
  const UID = 'member-a';

  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: 'pk-guard-read',
      firestore: {
        host: '127.0.0.1',
        port: 8080,
        rules: readFileSync(join(__dirname, '..', '..', 'firestore.rules'), 'utf8'),
      },
    });
  });
  afterAll(async () => { await env?.cleanup(); });

  it('a member can read their own intake status from the server', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'intakes', UID), { uid: UID, status: 'complete' });
    });
    const db = env.authenticatedContext(UID).firestore();
    const snap = await assertSucceeds(getDocFromServer(doc(db, 'intakes', UID)));
    expect((snap as any).data().status).toBe('complete');
  });

  it('a missing intake reads as absent rather than erroring', async () => {
    const db = env.authenticatedContext('no-intake-yet').firestore();
    const snap: any = await assertSucceeds(getDocFromServer(doc(db, 'intakes', 'no-intake-yet')));
    // Modular SDK: exists() is a method. The guard uses the compat SDK, where
    // it is a property — hence snap.exists there and snap.exists() here.
    expect(snap.exists()).toBe(false);
  });
});
