# Layout Fix: Bottom Chat Position

The goal is to ensure the chat input (footer) is correctly positioned at the bottom of the screen on both desktop and mobile, and on mobile, it should sit above the bottom navigation bar without overlapping.

## Plan

1. [x] Define a global CSS variable for the bottom navigation height in `src/theme/variables.scss`.
2. [x] Update `app-bottom-nav` SCSS to use this height consistently.
3. [x] Update `AiAssistantPage` SCSS to use the global variable for its footer margin-bottom.
4. [x] Refactor `ChatPage` to use `ion-footer` instead of `slot="fixed"` for consistency with `AiAssistantPage`.
5. [x] Ensure `ChatPage` also respects the bottom navigation height on mobile via the global variable.
6. [x] Verify the changes.

## Verification
- Desktop (>= 992px): No bottom margin on chat footers.
- Mobile (< 992px): Proper margin above bottom nav.
