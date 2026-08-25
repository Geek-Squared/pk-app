import { initializeTestEnvironment, assertFails, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc } from 'firebase/firestore';

/**
 * Proves the rules harness itself works: vitest runs in Node, the emulator is
 * reachable, and rules are actually enforced.
 *
 * Uses inline rules rather than firestore.rules on purpose — the real ruleset
 * has to be exported from the console first (tasks.md T005), and this test must
 * not depend on that. It verifies the runner, not the product rules.
 */
describe('rules harness', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: 'demo-harness-smoke',
      firestore: {
        host: '127.0.0.1',
        port: 8080,
        rules: `
          rules_version = '2';
          service cloud.firestore {
            match /databases/{db}/documents {
              match /{document=**} { allow read, write: if false; }
            }
          }
        `,
      },
    });
  });

  afterAll(async () => { await env?.cleanup(); });

  it('enforces a deny rule, proving rules are evaluated', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'anything/at-all')));
  });
});
