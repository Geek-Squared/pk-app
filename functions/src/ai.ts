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

/**
 * Peekay Chat Flow (Secure RAG Implementation)
 * Wrapped in a lazy-initialization function for cloud stability.
 */
export const runPeekayChat = async (input: { messages: any[]; userId: string }) => {
  const ai = getAi();
  const retriever = getRetriever();

  // Normalize messages: GenKit expects content to be an array of parts e.g. [{ text: '...' }]
  const normalizedMessages = input.messages.map((m: any) => ({
    role: m.role,
    content: Array.isArray(m.content)
      ? m.content
      : [{ text: typeof m.content === 'string' ? m.content : String(m.content) }],
  }));

  // Extract last user message text for retrieval query
  const lastMessage = normalizedMessages[normalizedMessages.length - 1];
  const lastUserMessageText: string =
    lastMessage?.content?.[0]?.text ?? '';

  // --- Context Retrieval ---
  const contextDocs = await ai.retrieve({
    retriever: retriever,
    query: lastUserMessageText,
    options: { limit: 3 },
  });

  const contextText = contextDocs.map((d: any) => d.text).join('\n---\n');

  const response = await ai.generate({
    model: openAI.model('gpt-4o-mini'),
    system: `You are Peekay, the Official Wellness Curator for Positive Konnections. 
    Your mission is to guide users through their HERO'S journey using the therapeutic workbook content.
    
    GUARDRAILS:
    - Deep empathy only.
    - No medical prescriptions.
    - Use "we" and "us" to emphasize community.
    
    CONTEXT FROM CURRICULUM:
    ${contextText}
    
    INSTRUCTION: Use the context above to inform your empathetic guidance.`,
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
  };
};
