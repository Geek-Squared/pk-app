# Task: Implement Message Deletion

Add a 3-dot (ellipsis) menu to each message and implement the functionality to delete a message from a chat.

## Plan

1. [ ] Update `src/app/services/chat.service.ts`:
    - Add `deleteMessage(chatId: string, message: any)` method.
    - Use Firestore `arrayRemove` to delete the specific message object.
2. [ ] Update `src/app/pages/messages/chat/chat.component.ts`:
    - Inject `ActionSheetController`.
    - Implement `presentMessageOptions(event: any, msg: any, index: number)`.
    - Add a `deleteMessage` helper method to call the service and show a confirmation toast.
3. [ ] Update `src/app/pages/messages/chat/chat.component.html`:
    - Add a `button.message-options-btn` with an `ellipsis-vertical` icon for each message.
    - Position it next to the bubble container.
4. [ ] Update `src/app/pages/messages/chat/chat.component.scss`:
    - Style the options button to be subtle (visible on hover or always on mobile if needed).
    - Correct positioning within `.message-row`.

## Verification
- Clicking the 3-dot menu opens an action sheet with a "Delete" option.
- Clicking "Delete" removes the message from Firestore.
- The UI reflects the deletion immediately (thanks to Firestore observable).
- Confirm it works for text, images, and audio messages.
