# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Positive Konnections** (`pk-app`) is a mental health support mobile/web app for the Positive Konnections programme. It is built with Angular 20 + Ionic 8 + Capacitor 8, targeting Android (primary) and web. Firebase is the entire backend — Firestore for data, Firebase Auth for authentication, Firebase Functions for AI and push dispatch, and FCM for push notifications.

## Commands

```bash
# Install dependencies
npm install

# Run dev server (web)
npm start               # ng serve

# Build for production
npm run build           # ng build

# Build and watch (dev mode)
npm run watch

# Run unit tests
npm test                # ng test (Karma + Jasmine)

# Run a single test file
npx ng test --include='src/app/services/chat.service.spec.ts'

# Lint (tslint)
npx tslint -p tsconfig.json

# Firebase Functions — from the functions/ directory
cd functions && npm run build    # compile TypeScript
cd functions && npm run serve    # local emulator
firebase deploy --only functions # deploy all functions

# Capacitor — sync web build to Android
npx cap sync android
npx cap open android             # open in Android Studio
```

Node version is pinned in `.nvmrc`. Use `nvm use` before running commands.

## Architecture

### Frontend (Angular + Ionic)

The app uses **NgModule-based Angular** (not standalone components, except `BottomNavComponent`). All routes are lazy-loaded via `loadChildren`. The entire protected tree sits under one `AuthGuard` (`src/app/guards/auth.guard.ts`) which checks `localStorage.user.emailVerified`.

**Route structure** (`src/app/app-routing.module.ts`):
- Auth-guarded subtree: `home`, `chapters`, `posts/:chapterId`, `questions/:postId`, `my-work-book`, `messages`, `ai-assistant`, `bookings`, `notifications`, `interventions`, `referrals`, `profile`, `about`, `introduction`
- Public: `login`, `registration`, `reset-password`, `surveys`

**Shared components** (`src/app/components/`): `BottomNavComponent` (standalone, auto-hides on auth routes), `VoiceNoteComponent`, `EmojiPickerComponent`, `ReactionPickerComponent`, `ProgressHeroCardComponent`, `BackButtonComponent`.

**Layout rule** (from `tasks/lessons.md`): The fixed premium header is `80px` tall. Standard content offset is `104px` (header + 24px air). Pages with bleeding backgrounds (Home, Profile) use `.no-header-offset` on `ion-content` and handle internal positioning manually. Never apply `padding-top` to both the app shell and `ion-content`.

### Services Layer (`src/app/services/`)

| Service | Responsibility |
|---|---|
| `AuthenticationService` | Firebase Auth sign-in/up/out, user document seeding, email verification, Google OAuth, account deletion |
| `ChatService` | Firestore `chats` collection — private and group messaging, message reactions, message deletion, FCM push dispatch |
| `WorkbookService` | Firestore `workbooks` collection — user reflections, coin ledger (`coinBalance`/`coinHistory`), hero profile |
| `AiChatService` | Calls the `peekayChat` Firebase callable function — never calls OpenAI directly |
| `FcmService` | Handles push registration for both native (Capacitor `@capacitor-firebase/messaging`) and web (Firebase Messaging SDK + service worker) |
| `AiValidationService` | Calls `validateAiResponse` Firebase callable to score workbook reflection quality |
| `AvatarService` | Calls `generateHeroAvatar` Firebase callable to generate hero avatar images |
| `InAppNotificationsService` | In-memory unread badge state for the notifications tab |

### Firebase / Backend

Firebase project ID: `positive-konnections-42d8a` (active). A legacy project (`positive-konnections-578ca`) is commented out in `environment.ts`.

**Firestore collections used by the app:**
- `users/{uid}` — profile, `isOnline`, `deviceId`, `webFcmTokens`, `role`
- `chats/{chatId}` — messages array, `uids`, `type` (`private`|`group`), `request` (counsellor flow)
- `workbooks/{workbookId}` — `responses[]`, `coinBalance`, `coinHistory`, `heroProfile`
- `knowledge_index` — RAG embeddings for the AI assistant (text + vector)

**Cloud Functions** (`functions/src/index.ts`):
- `processSignUp` — sets `client: true` custom claim on new auth users
- `peekayChat` — RAG-backed AI chat (calls `runPeekayChat` in `functions/src/ai.ts`)
- `onPostWrite` — Firestore trigger on `posts/{postId}` (create/update/delete) that indexes the intervention **curriculum** into `knowledge_index`. Indexed text = post title + description + its reflection-question narratives (from the `questions` collection), embedded and stored as `knowledge_index/post_{postId}` with `metadata { postId, chapterId, source: 'post', updatedAt }`
- `indexAllPosts` — admin-only callable that backfills all existing posts into `knowledge_index` (run once after deploy / when posts predate the trigger)
- `validateAiResponse` — scores reflection quality (0–10) via OpenAI
- `generateHeroAvatar` — generates hero avatar PNG via OpenAI `gpt-image-1`
- Various workbook completion / admin notification functions

### AI / RAG Pipeline (`functions/src/ai.ts`)

- Framework: **Genkit** with `@genkit-ai/compat-oai/openai`
- Chat model: `gpt-4o-mini` (temperature 0.4, max 800 tokens)
- Embedding model: `text-embedding-3-small`
- Vector store: Firestore `knowledge_index` collection via `defineFirestoreRetriever` (COSINE distance, `vectorField: 'embedding'`, `contentField: 'text'`). Requires the vector indexes in `firestore.indexes.json` (a flat index on `embedding`, plus a composite `metadata.source` + `embedding` index for the filtered query)
- **What it retrieves:** the **intervention curriculum**, not the user's workbook answers. `runPeekayChat` builds a query from the last up to 3 user messages, then retrieves up to 3 curriculum docs filtered `where metadata.source == 'post'`, and injects them as `CONTEXT FROM INTERVENTION CURRICULUM` into the system prompt. So a message like "I want to commit suicide" surfaces the matching intervention's content
- Crisis handling: `runPeekayChat` keyword-scans the last user message (`CRISIS_KEYWORDS`) and returns a `crisis` flag that the UI uses to show a "Talk to a Counsellor" button
- Conversation history is persisted **client-side** at `users/{uid}/peekayChats` (written by `AiChatService.saveMessage`, read by `loadHistory`) — the cloud function is stateless
- OpenAI API key is stored as a Firebase secret (`OPENAI_API_KEY`), never in the frontend
- Retrieval is intentionally **global** (not per-`userId`): the curriculum is shared content, so there is nothing personal to scope. `userId` is passed to `runPeekayChat` but currently unused

### Capacitor / Mobile

App ID: `com.positivekonnections.app`. Android project lives in `android/`. The `www/` directory is the Capacitor web dir (built Angular output). Key Capacitor plugins: `@capacitor/camera`, `@capacitor/filesystem`, `capacitor-voice-recorder`, `@capacitor-firebase/messaging`, `@capacitor/push-notifications`.

Push notifications differ by platform: native uses `FirebaseMessaging` from `@capacitor-firebase/messaging`; web uses the Firebase Messaging SDK with a `firebase-messaging-sw.js` service worker. `FcmService` branches on `Capacitor.getPlatform()`.

## Workflow Conventions (from .cursorrules)

- Write a plan to `tasks/todo.md` with checkable items before starting non-trivial work
- After any correction, update `tasks/lessons.md` with the pattern learned
- Never mark a task complete without verifying it works
- Aim for minimal-impact changes — only touch what's necessary
