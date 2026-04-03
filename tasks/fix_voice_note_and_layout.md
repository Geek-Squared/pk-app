# Task: Fix Voice Note Visibility and Mobile Layout

Resolve the "blank pill" issue in voice messages and ensure the chat footer is correctly positioned above the bottom navigation on mobile.

## Plan

### 1. Dedicated VoiceNote Component (The Fix)
- [ ] Create `VoiceNoteComponent` in `src/app/components/voice-note/`:
    - [ ] `voice-note.component.ts`: Handle audio playback, duration, and progress state.
    - [ ] `voice-note.component.html`: High-fidelity UI with play button and progress bar.
    - [ ] `voice-note.component.scss`: Premium styling for both Sender (blue background) and Recipient (white background).
- [ ] Integrate `VoiceNoteComponent` into `ChatComponent`:
    - [ ] Import the component in `chat.component.ts`.
    - [ ] Replace inline audio code in `chat.component.html` with `<app-voice-note>`.
    - [ ] Clean up redundant SCSS in `chat.component.scss`.

### 2. Layout Fix (Mobile Overlap)
- [x] Review `app.component.html` and `bottom-nav.component.scss` interaction.
- [ ] Fine-tune `chat-footer` padding/margin to ensure it's ALWAYS above the nav.

## Verification
- Confirm voice bubble has a fixed `min-width` and high-contrast visuals.
- Verify playback logic works inside the new component.
