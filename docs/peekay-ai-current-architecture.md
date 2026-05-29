# Peekay AI: Current Architecture and Context Growth

Prepared: 6 May 2026

## Executive Summary

Peekay AI currently works as a secure Firebase-backed AI assistant. The mobile/web app does not call OpenAI directly for chat. It sends chat messages to the Firebase callable function `peekayChat`, and the backend uses Genkit with OpenAI to generate the reply.

The important distinction is this: OpenAI generates the final language response, but the contextual knowledge used by the chat is retrieved from our own Firestore database, specifically the `knowledge_index` collection. OpenAI is not the source of the workbook context. OpenAI is used to create embeddings and to generate the assistant response from the prompt, retrieved database context, guardrails, and conversation history.

## AI Areas in the Codebase

There are four AI-related areas in the current codebase:

1. Peekay AI chat.
   - Frontend: `src/app/pages/ai-assistant/ai-assistant.page.ts`
   - Frontend service: `src/app/services/ai-chat.service.ts`
   - Backend callable function: `functions/src/index.ts`, export `peekayChat`
   - Core AI/RAG logic: `functions/src/ai.ts`

2. Workbook knowledge indexing.
   - Automatic Firestore trigger: `functions/src/index.ts`, export `onWorkbookStoryCreated`
   - One-off backfill script: `functions/scripts/backfill_knowledge.ts`
   - Firestore collection used for retrieval: `knowledge_index`

3. Workbook/reflection validation.
   - Frontend service: `src/app/services/ai-validation.service.ts`
   - Backend callable function: `functions/src/index.ts`, export `validateAiResponse`

4. Hero avatar generation.
   - Frontend service: `src/app/services/avatar.service.ts`
   - Backend callable function: `functions/src/index.ts`, export `generateHeroAvatar`

## How Peekay Chat Works Today

The user types into the AI assistant page. The page keeps the current chat messages in memory, then sends the message history through `AiChatService`.

`AiChatService` calls the Firebase callable function `peekayChat` with a payload shaped like this:

```json
{
  "messages": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

The frontend does not include the OpenAI key. The OpenAI API key is only used in Firebase Functions through the `OPENAI_API_KEY` secret.

On the backend, `peekayChat` requires the user to be authenticated. It then calls `runPeekayChat()` in `functions/src/ai.ts`.

Inside `runPeekayChat()`:

1. The incoming chat history is normalized for Genkit.
2. Previous app-side assistant messages are converted from role `assistant` to Genkit role `model`.
3. The latest user message is extracted.
4. Genkit retrieves up to 3 relevant documents from Firestore using the configured Firestore retriever.
5. The retrieved database text is joined into `contextText`.
6. The backend system prompt inserts that retrieved text under `CONTEXT FROM CURRICULUM`.
7. OpenAI model `gpt-4o-mini` generates the final response using:
   - the backend mental-health guardrails,
   - the retrieved Firestore context,
   - the current chat history,
   - temperature `0.4`,
   - max output tokens `800`.

## Where Chat Context Comes From

The chat context comes from Firestore, not from OpenAI.

The retriever is defined in `functions/src/ai.ts` using `defineFirestoreRetriever`. Its configuration points to:

- Firestore collection: `knowledge_index`
- Text field: `text`
- Vector field: `embedding`
- Embedder: `text-embedding-3-small`
- Distance measure: `COSINE`

When the user sends a chat message, the latest user message is used as the retrieval query. Genkit compares that query against the stored embeddings in `knowledge_index` and returns the closest matching documents. The returned document text is then injected into the chat prompt as curriculum context.

OpenAI is involved in two supporting ways:

1. OpenAI creates embeddings with `text-embedding-3-small`.
2. OpenAI generates the final chat response with `gpt-4o-mini`.

However, the actual contextual text used by Peekay comes from our Firestore `knowledge_index.text` field. OpenAI does not provide the curriculum/context database.

## How Context Is Generated

Context is generated from workbook responses.

The automatic indexer is the Firestore trigger `onWorkbookStoryCreated` in `functions/src/index.ts`. It runs whenever a document in `workbooks/{workbookId}` is updated.

The trigger:

1. Reads the updated workbook document.
2. Checks for a `responses` field.
3. Extracts response text from each response using `answer` or `content`.
4. Joins those response values into one text string.
5. Sends that text to Genkit/OpenAI to create an embedding with `text-embedding-3-small`.
6. Writes a new document to `knowledge_index` with:
   - `text`: the workbook response text,
   - `embedding`: the vector representation,
   - `metadata.uid`: the workbook user id when present,
   - `metadata.workbookId`: the workbook document id,
   - `metadata.updatedAt`: the indexing timestamp.

There is also a one-off script, `functions/scripts/backfill_knowledge.ts`, which indexes existing workbook documents into `knowledge_index`. That script is designed for bootstrapping older workbook data that existed before the automatic trigger was added.

## What OpenAI Does and Does Not Do

OpenAI does:

- Generate the final Peekay chat response.
- Convert database text into embeddings for semantic search.
- Validate workbook reflections in the separate `validateAiResponse` flow.
- Generate hero avatar images in the separate `generateHeroAvatar` flow.

OpenAI does not:

- Store the app's knowledge base.
- Own the curriculum context.
- Automatically know the user's workbook content.
- Retrieve the contextual text by itself.
- Replace Firestore as the source of context.

The current RAG flow is database-first: our Firestore data is indexed, retrieved, and injected into the prompt. OpenAI receives that retrieved text at generation time.

## Current Guardrails

The backend chat prompt currently positions Peekay as a mental health support guide for Positive Konnections.

The prompt instructs Peekay to focus on:

- emotional reflection,
- stress,
- anxiety,
- low mood,
- stigma,
- relationships,
- self-worth,
- HIV-related feelings,
- grounding,
- coping skills,
- workbook reflection.

The prompt also tells Peekay not to:

- analyze sleep data,
- prescribe workouts,
- give medical advice,
- diagnose conditions,
- make physical health claims.

The frontend visible prompts were also updated away from sleep/workout language and toward stress, anxiety, grounding, and emotional support.

## Important Current Limitations

The current implementation has a few important limits:

1. `metadata.uid` is stored in `knowledge_index`, and `peekayChat` passes `userId` into `runPeekayChat`, but retrieval is not currently filtered by that user id. The retriever currently searches the configured `knowledge_index` collection generally.

2. Workbook indexing stores each workbook's combined response text as a single indexed text block. This works as a first pass, but smaller chunks by chapter/question would likely improve retrieval quality.

3. The frontend and some comments mention PII scrubbing, but there is no clear implemented PII masking layer in the current chat path.

4. AI chat messages are currently held in the AI assistant page state. They are not persisted as a dedicated AI chat history collection in Firestore.

5. The current Firestore trigger adds new `knowledge_index` documents on workbook update. It does not appear to update or replace a previous index document for the same workbook, so duplicate or stale entries may build up over time unless managed.

6. `AvatarService` still contains an unused local `apiUrl` and local `buildPrompt()` helper, but actual avatar generation uses the secure Firebase callable function.

## How The AI Context Will Grow

The context will grow as more workbook responses are saved and indexed.

Today, the growth path is:

1. A user completes or updates workbook content.
2. The workbook document in Firestore updates.
3. `onWorkbookStoryCreated` extracts the workbook response text.
4. The backend creates an embedding for that text.
5. The text and embedding are stored in `knowledge_index`.
6. Future Peekay chat messages can retrieve that indexed text when semantically relevant.

The backfill script can also be run to populate `knowledge_index` from existing workbook documents.

Recommended next growth steps:

1. Filter retrieval by user where appropriate.
   Since `metadata.uid` is already stored, the next step is to enforce user-specific retrieval for personal workbook content, while keeping shared curriculum content separate.

2. Separate personal memory from shared curriculum.
   A strong future structure would be:
   - `knowledge_index_personal` for user workbook reflections,
   - `knowledge_index_curriculum` for approved Positive Konnections curriculum and workbook guidance.

3. Chunk content more carefully.
   Instead of storing an entire workbook response set as one text block, store smaller chunks by chapter, question, theme, or intervention. This should make retrieved context more precise.

4. Add metadata for better retrieval.
   Useful metadata could include chapter id, question id, topic, age band, content type, safety category, and whether the text is user-generated or staff-approved.

5. Add cleanup/upsert behavior.
   When a workbook changes, the indexer should update the existing index records for that workbook or delete stale records before adding new ones.

6. Add PII masking before embedding and generation.
   If personal user reflections are indexed, the backend should mask emails, phone numbers, names where possible, and other sensitive identifiers before sending text to the embedding or chat model.

7. Add moderation and crisis handling.
   The mental health use case should eventually include explicit crisis detection, escalation copy, and safe routing to counsellors or emergency support.

8. Persist AI chat history intentionally.
   If product requirements need continuity across sessions, create a dedicated AI chat history collection with clear retention and privacy rules.

## Confirmation

Based on the current code audit, Peekay chat context does not come from OpenAI as a source of truth. Context is generated from Firestore workbook data, stored in the Firestore `knowledge_index` collection, retrieved from that collection during chat, and then passed to OpenAI as prompt context.

OpenAI is the language model and embedding provider. Our database is the context source.

