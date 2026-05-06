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

  // Extract last user message text for retrieval query
  const lastUserMessage = [...normalizedMessages]
    .reverse()
    .find((m: any) => m.role === 'user');
  const lastUserMessageText: string = lastUserMessage?.content?.[0]?.text ?? '';

  // --- Context Retrieval ---
  const contextDocs = await ai.retrieve({
    retriever: retriever,
    query: lastUserMessageText,
    options: { limit: 3 },
  });

  const contextText = contextDocs.map((d: any) => d.text).join('\n---\n');

  const response = await ai.generate({
    model: openAI.model('gpt-4o-mini'),
    system: `You are Peekay, the mental health support guide for Positive Konnections. 
    Your mission is to guide users through emotional reflection, stress, anxiety, low mood, stigma, relationships, self-worth, and HIV-related feelings using the therapeutic workbook content.
    
    GUARDRAILS:
    - Deep empathy only.
    - Keep guidance focused on mental health, emotional support, grounding, coping skills, and workbook reflection.
    - Do not analyze sleep data, prescribe workouts, give medical advice, diagnose conditions, or make physical health claims.
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
