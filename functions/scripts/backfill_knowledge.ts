import * as admin from 'firebase-admin';
import { genkit } from 'genkit';
import { openAI } from '@genkit-ai/compat-oai/openai';

/**
 * Phase 3: Knowledge Base Backfill Script
 * Run this ONCE to index all existing user workbooks into Peekay's memory.
 */

// Initialize Admin for the environment
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const ai = genkit({
  plugins: [openAI()],
});

async function backfillKnowledge() {
  const firestore = admin.firestore();
  
  // 1. Fetch all workbooks
  const workbooksSnap = await firestore.collection('workbooks').get();

  let count = 0;
  for (const doc of workbooksSnap.docs) {
    const data = doc.data();
    if (!data.responses) continue;

    // 2. Extract and refine text
    const responsesText = Array.isArray(data.responses)
      ? data.responses.map((r: any) => r.answer || r.content).join(' ')
      : Object.values(data.responses).map((r: any) => r.answer || r.content).join(' ');

    if (!responsesText.trim()) continue;

    try {
      // 3. Generate Vector (Embedding) using the correct GenKit 1.x property
      const embedding = await ai.embed({
        embedder: openAI.embedder('text-embedding-3-small'),
        content: responsesText,
      });

      // 4. Save to Index
      await firestore.collection('knowledge_index').add({
        text: responsesText,
        embedding: embedding,
        metadata: {
          uid: data.uid || 'system',
          workbookId: doc.id,
          updatedAt: admin.firestore.Timestamp.now(),
          isBackfill: true
        }
      });

      count++;
    } catch (e) {
      console.error(`Failed to index ${doc.id}:`, e);
    }
  }

}

backfillKnowledge();
