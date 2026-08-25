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


  // Surface which workbook story the retrieved context came from, so the UI can
  // deep-link the user straight to that story (falling back to the intervention
  // for docs indexed before postTitle/chapterId were stored).
  // (defineFirestoreRetriever returns the stored doc data under `metadata`, so
  // our nested map is at metadata.metadata.)
  const sources: Array<{
    postId?: string;
    chapterId?: string;
    postTitle?: string;
    interventionId?: string;
    interventionName?: string;
  }> = [];
  const seen = new Set<string>();
  for (const d of contextDocs as any[]) {
    const md = d?.metadata?.metadata ?? d?.metadata ?? {};
    const postId = md?.postId;
    const chapterId = md?.chapterId;
    const interventionId = md?.interventionId;

    // Only surface a source the UI can actually navigate to.
    const canLinkToPost = !!(postId && chapterId);
    if (!canLinkToPost && !interventionId) continue;

    // Identify by post where we can, so two stories from the same intervention
    // both show rather than collapsing into one chip.
    const key = canLinkToPost ? `post:${postId}` : `intv:${interventionId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const source: {
      postId?: string;
      chapterId?: string;
      postTitle?: string;
      interventionId?: string;
      interventionName?: string;
    } = {};
    if (canLinkToPost) {
      source.postId = postId;
      source.chapterId = chapterId;
      if (md?.postTitle) source.postTitle = md.postTitle;
    }
    if (interventionId) {
      source.interventionId = interventionId;
      source.interventionName = md?.interventionName || 'Intervention';
    }
    sources.push(source);
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

    INSTRUCTION: The curriculum above is the Positive Konnections programme material this user is working through in their sessions. It is your primary source. Ground your reply in it whenever it speaks to what the user is expressing, and prefer it over generic advice.

    Much of this material teaches through story metaphors — a character, a battle, a journey — which are then applied to living with HIV and to mental health. The metaphor IS the teaching, not decoration. Use it: name the image in a sentence or two, then carry it into the point it makes and into what this user is going through, so they recognise it from their sessions. Do not simply retell the plot and do not quote long passages.

    Fall back on general supportive guidance only when nothing in the curriculum above genuinely relates to the user's concern.`,
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
