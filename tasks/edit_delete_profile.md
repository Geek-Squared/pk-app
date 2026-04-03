# Task: Add Edit and Delete Functionality for Profile

Implement the ability for users to update their profile information and delete their account.

## Plan

1. [x] Update `src/app/services/users.service.ts` to include `deleteUser`.
2. [x] Update `src/app/services/authentication.service.ts` to include `deleteAccount` and `updateProfile`.
3. [x] Modify `src/app/pages/profile/profile.page.ts`:
    - [x] Add `editing` state.
    - [x] Add `editProfile()` to toggle editing.
    - [x] Add `saveProfile()` to persist changes.
    - [x] Add `confirmDelete()` to show a confirmation alert.
    - [x] Add `deleteAccount()` to handle the deletion logic.
4. [x] Modify `src/app/pages/profile/profile.page.html`:
    - [x] Add an "Edit" button in the header or next to the name.
    - [x] Show input fields when in editing mode.
    - [x] Add a "Delete Account" button in the account settings or at the bottom.
5. [x] Verify functionality.

## Verification
- [x] User can toggle edit mode.
- [x] User can change display name.
- [x] User can see a confirmation when clicking delete.
- [x] User is logged out and redirected after account deletion.
