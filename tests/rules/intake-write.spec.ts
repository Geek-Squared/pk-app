import { initializeTestEnvironment, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Reproduces the exact write IntakeService.saveStep() issues — arrayUnion and
 * serverTimestamp included — against the deployed rules. A simpler setDoc
 * already passes, so this isolates whether the sentinel values are what the
 * rules reject.
 */
describe('the real saveStep write', () => {
  let env: RulesTestEnvironment;
  const UID = 'member-a';

  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: 'pk-intake-write',
      firestore: {
        host: '127.0.0.1',
        port: 8080,
        rules: readFileSync(join(__dirname, '..', '..', 'firestore.rules'), 'utf8'),
      },
    });
  });
  afterAll(async () => { await env?.cleanup(); });

  it('creates intakes/{uid} with arrayUnion + serverTimestamp', async () => {
    const db = env.authenticatedContext(UID).firestore();
    await assertSucceeds(
      setDoc(
        doc(db, 'intakes', UID),
        {
          fullName: 'Test Person',
          age: 32,
          phoneNumber: '+263778800935',
          email: 'x@y.com',
          uid: UID,
          status: 'in_progress',
          completedSteps: arrayUnion('identity'),
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true }
      )
    );
  });

  it('writes users/{uid}.onboardingStatus the way the service does', async () => {
    const db = env.authenticatedContext(UID).firestore();
    await assertSucceeds(
      setDoc(doc(db, 'users', UID), { onboardingStatus: 'in_progress' }, { merge: true })
    );
  });
});
