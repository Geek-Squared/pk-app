/* eslint-disable import/no-unresolved */
import { genkit } from 'genkit';
import { openAI } from '@genkit-ai/compat-oai/openai';
export { openAI };
import { defineFirestoreRetriever } from '@genkit-ai/firebase';
import * as admin from 'firebase-admin';

/**
 * GenKit Engine for Positive Konnections (Phase 3 - Lazy Init)
 * Ensures secrets are fully loaded before AI tools are instantiated.
 */
let aiInstance: any = null;
let retrieverInstance: any = null;

export function getAi() {
  if (!aiInstance) {
    aiInstance = genkit({
      plugins: [openAI()],
    });
  }
  return aiInstance;
}

export function getRetriever() {
  const ai = getAi();
  if (!retrieverInstance) {
    retrieverInstance = defineFirestoreRetriever(ai, {
      name: 'storiesRetriever',
      firestore: admin.firestore(),
      collection: 'knowledge_index',
      vectorField: 'embedding',
      contentField: 'text',
      embedder: openAI.embedder('text-embedding-3-small'),
      distanceMeasure: 'COSINE',
    });
  }
  return retrieverInstance;
}

const CRISIS_KEYWORDS = [
  'kill myself', 'killing myself', 'end my life', 'end it all',
  'want to die', 'wanna die', 'going to die', 'suicide', 'suicidal',
  'hurt myself', 'self harm', 'self-harm', 'no reason to live',
  "can't go on", 'cant go on', 'give up on life', 'not worth living',
  'take my life', 'overdose', 'cut myself',
];

function isCrisisMessage(text: string): boolean {
  const lower = text.toLowerCase();
  return CRISIS_KEYWORDS.some(kw => lower.includes(kw));
}

/**
 * Peekay Chat Flow (Secure RAG Implementation)
 * Wrapped in a lazy-initialization function for cloud stability.
 */
export const runPeekayChat = async (input: { messages: any[]; userId: string }) => {
  const ai = getAi();
  const retriever = getRetriever();

  const toGenkitRole = (role: any) => {
    if (role === 'assistant') return 'model';
    if (['system', 'user', 'model', 'tool'].includes(role)) return role;
    return 'user';
  };

  const toTextParts = (content: any) => {
    if (Array.isArray(content)) {
      return content
        .map((part: any) => {
          if (typeof part?.text === 'string') return { text: part.text };
          if (typeof part === 'string') return { text: part };
          return null;
        })
        .filter(Boolean);
    }

    return [{ text: typeof content === 'string' ? content : String(content ?? '') }];
  };

  // Genkit expects model replies to use role "model", not OpenAI-style "assistant".
  const normalizedMessages = (Array.isArray(input.messages) ? input.messages : [])
    .map((m: any) => ({
      role: toGenkitRole(m?.role),
      content: toTextParts(m?.content),
    }))
    .filter((m: any) => m.content.length > 0);

  // Check last user message for crisis language
  const lastUserText = normalizedMessages
    .filter((m: any) => m.role === 'user')
    .slice(-1)[0]?.content?.[0]?.text ?? '';
  const crisis = isCrisisMessage(lastUserText);

  // Build a richer retrieval query from up to the last 3 user messages
  const queryText = normalizedMessages
    .filter((m: any) => m.role === 'user')
    .slice(-3)
    .map((m: any) => m.content?.[0]?.text ?? '')
    .filter(Boolean)
    .join(' ');

  // Retrieve relevant intervention curriculum posts (shared across all users)
  const contextDocs = queryText
    ? await ai.retrieve({
        retriever: retriever,
        query: queryText,
        options: { limit: 3, where: { 'metadata.source': 'post' } },
      })
    : [];


  const contextText = contextDocs
    .map((d: any) => d.text ?? d.content?.[0]?.text ?? '')
    .filter(Boolean)
    .join('\n---\n');


  // Surface which intervention(s) the retrieved context came from, so the UI
  // can link the user straight to that intervention. (defineFirestoreRetriever
  // returns the stored doc data under `metadata`, so our nested map is at
  // metadata.metadata.)
  const sources: Array<{ interventionId: string; interventionName: string }> = [];
  const seenInterventions = new Set<string>();
  for (const d of contextDocs as any[]) {
    const md = d?.metadata?.metadata ?? d?.metadata ?? {};
    const id = md?.interventionId;
    const name = md?.interventionName;
    if (id && !seenInterventions.has(id)) {
      seenInterventions.add(id);
      sources.push({ interventionId: id, interventionName: name || 'Intervention' });
    }
  }

  const response = await ai.generate({
    model: openAI.model('gpt-4o-mini'),
    system: `You are Peekay, the mental health support guide for Positive Konnections.
    Your mission is to guide users through emotional reflection, stress, anxiety, low mood, stigma, relationships, self-worth, and HIV-related feelings using the therapeutic workbook content.

    GUARDRAILS:
    - Deep empathy only.
    - Keep guidance focused on mental health, emotional support, grounding, coping skills, and workbook reflection.
    - Do not analyze sleep data, prescribe workouts, give medical advice, diagnose conditions, or make physical health claims.
    - Use "we" and "us" to emphasize community.

    CONTEXT FROM INTERVENTION CURRICULUM:
    ${contextText}

    INSTRUCTION: Use the curriculum content above ONLY when it is relevant to what the user is expressing. If it does not fit their concern, disregard it and rely on your general supportive guidance. Where it is relevant, connect your response to themes or reflection exercises the user may recognise from their sessions. Do not quote or narrate the illustrative story prompts verbatim — draw on their themes, not their plots.`,
    messages: normalizedMessages as any,
    config: {
      temperature: 0.4,
      maxOutputTokens: 800,
    },
  });

  return {
    choices: [
      {
        message: {
          role: 'assistant',
          content: response.text,
        },
      },
    ],
    crisis,
    sources,
  };
};
