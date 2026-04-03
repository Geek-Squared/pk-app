# Task: Create Profile Page

Create a premium profile page that pulls user details from Firebase/LocalStorage.

## Plan

1. [ ] Identify user data source (`AuthenticationService` and Firestore `users` collection).
2. [ ] Create profile page structure:
   - `src/app/pages/profile/profile.page.html`
   - `src/app/pages/profile/profile.page.scss`
   - `src/app/pages/profile/profile.page.ts`
   - `src/app/pages/profile/profile.module.ts`
   - `src/app/pages/profile/profile-routing.module.ts`
3. [ ] Implement user data fetching in `ProfilePage`.
4. [ ] Design a high-fidelity profile UI (avatar, email, name, stats/metadata).
5. [ ] Register route in `src/app/app-routing.module.ts`.
6. [ ] Update sidebar navigation in `src/app/app.component.html` and header links.
7. [ ] Verify functionality.

## Verification
- User enters Profile page.
- Correct user info (name, email, photo) is displayed.
- Profile page is accessible from sidebar/header.
