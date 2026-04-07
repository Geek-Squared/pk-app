# RAG Architecture Phase 1: Secure Backend Proxy & Data Protection

## 1. Research & Analysis
- [ ] Inspect existing `AiChatService` to identify current message format and API endpoints. 
- [ ] Check `AuthenticationService` for Firebase JWT token accessibility.
- [ ] Verify Supabase project access and Edge Function capabilities.

## 2. Planning (Phase 1)
- [x] **Secure Proxy**: Move OpenAI API calls from the frontend to a Firebase Cloud Function (`peekayChat`).
- [x] **Identity Verification**: Implement user.auth check in the Cloud Function to verify the user's token before proxying.
- [x] **Data Protection Layer**: Add a PII (Personally Identifiable Information) scrubber in the Cloud Function to mask names/emails before LLM consumption.
- [x] **Instructional Guardrails**: Hardcode the "Peekay Rules" into the backend system message to prevent the AI from "learning" the wrong things or revealing internal logic.

## 3. Implementation
- [x] Create Firebase Cloud Function: `peekayChat` in `functions/src/index.ts`.
- [ ] Deploy OpenAI API Key as a Firebase Config Secret (`openai.key`).
- [ ] Modify `src/app/services/ai-chat.service.ts` to use `AngularFireFunctions` callable.
- [ ] Remove hardcoded OpenAI keys/endpoints from the Angular frontend.

## 4. Verification
- [ ] Verify message thread still functions correctly in the UI.
- [ ] Inspect network traffic to ensure no API keys or sensitive project IDs are exposed.
- [ ] Test the "Unlogged-in" case (should be rejected by the proxy).
- [ ] Verify PII masking (send an email in chat, check the masked output if possible).

## Review section
- (To be populated after implementation)
