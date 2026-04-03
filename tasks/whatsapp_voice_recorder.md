# Task: Implement WhatsApp-style Voice Recording

Upgrade the existing voice recording functionality to provide a full WhatsApp-like user experience.

## Plan

1. [x] Update `src/app/pages/messages/chat/chat.component.ts`:
    - [x] Add `recordingTimer` interval property.
    - [x] Fix `calculateDuration()` to run every second using an interval.
    - [x] Add `cancelRecording()` method.
    - [x] Add logic to handle "slide to cancel" or a dedicated cancel button.
    - [x] Ensure haptic feedback on start/stop/cancel.
2. [x] Update `src/app/pages/messages/chat/chat.component.html`:
    - [x] Add a recording UI overlay that covers the text input when recording is active.
    - [x] Display the pulsing red dot, timer, and cancel action.
3. [x] Update `src/app/pages/messages/chat/chat.component.scss`:
    - [x] Add styles for the recording overlay.
    - [x] Add pulsing animation for the recording indicator.
    - [x] Style the recording timer and cancel action.
4. [x] Verify functionality.

## Verification
- [x] Press and hold the mic button starts recording and shows the overlay.
- [x] Timer updates every second.
- [x] Pulsing red dot is visible.
- [x] Releasing the button sends the message.
- [x] Clicking/sliding to cancel stops recording and discards the audio.
