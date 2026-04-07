import { genkit, z } from 'genkit';
import { openAI } from '@genkit-ai/compat-oai/openai';
import { defineFirestoreRetriever } from '@genkit-ai/firebase';
import * as admin from 'firebase-admin';

/**
 * GenKit Engine for Positive Konnections (Phase 2)
 * Centralizes AI configuration, RAG search, and empathetic guardrails.
 */
export const ai = genkit({
  plugins: [
    openAI(), // API key taken from OPENAI_API_KEY env var
  ],
});

/**
 * Knowledge Retriever (Native Firestore Vector Search)
 */
export const storiesRetriever = defineFirestoreRetriever(ai, {
  name: 'storiesRetriever',
  firestore: admin.firestore(),
  collection: 'knowledge_index',
  vectorField: 'embedding',
  contentField: 'text',
  embedder: openAI.embedder('text-embedding-3-small'),
  distanceMeasure: 'COSINE',
});

/**
 * Peekay Chat Flow (Secure RAG Implementation)
 */
export const peekayChatFlow = ai.defineFlow(
  {
    name: 'peekayChatFlow',
    inputSchema: z.object({
      messages: z.array(
        z.object({
          role: z.enum(['user', 'assistant', 'system']),
          content: z.string(),
        })
      ),
      userId: z.string(),
    }),
  },
  async (input) => {
    const lastUserMessage = input.messages[input.messages.length - 1].content;
    
    // --- Context Retrieval (Part C) ---
    const contextDocs = await ai.retrieve({
      retriever: storiesRetriever,
      query: lastUserMessage,
      options: { limit: 3 },
    });

    const contextText = contextDocs.map(d => d.text).join('\n---\n');

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
      messages: input.messages as any,
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
  }
);
