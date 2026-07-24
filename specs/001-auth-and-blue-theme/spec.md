# Feature Specification: Blue-Theme Redesign & Auth Refresh

**Feature Branch**: `redesign/auth-and-blue-theme`

**Created**: 2026-06-24

**Status**: Documented (retroactive — describes work already delivered on this branch)

**Input**: User request: "I don't want to change anything feature-wise, just ensure our specs are up to speed and ready." This specification documents the redesign already implemented on the branch so the spec-kit artifacts reflect the shipped product.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cohesive blue-themed authentication (Priority: P1)

A person opening Positive Konnections for the first time lands on a visually consistent, calm, blue-themed sign-in experience. Login, registration, and reset-password all share the same brand look (gradient background, PK badge and brand mark, white-outlined Google button) instead of mismatched legacy styling. The visual identity established on the auth screens carries through the rest of the app.

**Why this priority**: Authentication is the first impression and the entry point to a mental-health product where trust and calm matter. A consistent, polished identity here sets the tone and is the namesake of the branch.

**Independent Test**: Open login, registration, and reset-password pages on web and Android and confirm a unified blue identity, working brand mark/badge, and that all existing sign-in/sign-up/reset actions still function.

**Acceptance Scenarios**:

1. **Given** a logged-out user, **When** they open the login page, **Then** they see the blue gradient background, PK badge/brand mark, and a white-outlined Google sign-in button.
2. **Given** a user on registration or reset-password, **When** the page loads, **Then** no legacy white toolbar header is shown and the page matches the login identity.
3. **Given** an existing user, **When** they sign in with email/password or Google, **Then** authentication succeeds exactly as before the redesign (handlers, routes, and template references preserved).
4. **Given** a user on any post-auth page, **When** they view primary accents (buttons, active states, headers), **Then** those accents use the brand blue family consistent with the auth screens.

---

### User Story 2 - Explicit Terms & Privacy consent at sign-up (Priority: P1)

A new user must explicitly agree to the Terms & Conditions and Privacy Policy before an account can be created. The agreement is recorded with the account as proof of consent, including the version agreed to and when. The Terms and Privacy Policy are readable in-app.

**Why this priority**: Recording informed consent is a legal/compliance safeguard for a mental-health product handling sensitive personal data, and it must be in place before any account exists.

**Independent Test**: Attempt to register without ticking consent (blocked with a message), then register with consent and verify the account is created and a consent record (agreed, version, timestamp) is stored against the user.

**Acceptance Scenarios**:

1. **Given** a user filling the registration form without agreeing to terms, **When** they submit, **Then** sign-up is blocked and they are prompted to agree to the Terms & Conditions and Privacy Policy.
2. **Given** a user who has agreed to terms, **When** they complete sign-up, **Then** the account is created and a consent record (agreement flag, consent version, accepted-at timestamp) is persisted with their user profile.
3. **Given** any user, **When** they open the Privacy Policy or Terms & Conditions, **Then** the corresponding in-app page is displayed.

---

### User Story 3 - Immersive AI assistant & chat experience (Priority: P2)

When a user opens the AI assistant ("Peekay") or a one-to-one chat, they get a focused, messaging-style, full-screen experience: the global app header and bottom navigation step out of the way, a sticky conversation header (avatar + online status) stays in view, message bubbles and the input dock feel like a modern chat app, and a clearly visible back control returns them to where they came from.

**Why this priority**: These are the highest-engagement conversational surfaces; an immersive, familiar chat layout improves focus and usability without changing the underlying conversation or AI behavior.

**Independent Test**: Open the AI assistant and a chat thread; confirm the global header and bottom nav are hidden, the sticky header and back control work, and sending/receiving messages behaves as before.

**Acceptance Scenarios**:

1. **Given** a user on the AI assistant or a chat thread, **When** the page is shown, **Then** the global header and bottom navigation are hidden and a sticky conversation header is displayed.
2. **Given** a user in an immersive conversation, **When** they tap the back control, **Then** they return to the previous screen (chat falls back to the messages list).
3. **Given** a user navigating away from an immersive route, **When** they land on any standard route, **Then** the global header and bottom navigation reappear.

---

### User Story 4 - Polished home, navigation, and supporting pages (Priority: P3)

A returning user sees a refreshed home screen (blue gradient hero, clearer call-to-action cards, soft action pills) and a redesigned bottom navigation (solid blue active pill, safe-area aware). New users can learn the app via a "How to use PK" page, and anyone can read the Privacy Policy and Terms & Conditions.

**Why this priority**: These refinements reinforce the unified identity and add onboarding/legal content, but they are enhancements layered on top of the core auth and conversation experiences.

**Independent Test**: Open home, the bottom nav, the how-to-use page, and the legal pages; confirm the refreshed visuals, safe-area behavior on Android, and that all links/CTAs navigate correctly.

**Acceptance Scenarios**:

1. **Given** a logged-in user on home, **When** the page loads, **Then** the blue gradient hero, intervention call-to-action, and soft-blue action pills are displayed.
2. **Given** a user on any standard page, **When** they view the bottom navigation, **Then** the active tab shows a solid blue pill and the bar respects the device safe-area inset.
3. **Given** a user wanting guidance, **When** they open "How to use PK", **Then** instructional content is displayed.

---

### Edge Cases

- **Consent not given**: Registration is blocked with a clear prompt; no account or consent record is created.
- **Consent version changes**: The recorded consent captures the version agreed to, so a future material change to Terms/Privacy can be detected by comparing versions.
- **Gradient/background rendering**: Auth gradients are applied where the platform honors them so the background renders consistently across web and Android.
- **Safe-area devices**: Bottom navigation and immersive footers respect device safe-area insets (notches/home indicators) without clipping controls.
- **Immersive route entry/exit**: Header and bottom nav reliably hide on immersive routes and restore on all other routes, including via hardware/browser back.
- **Existing accounts**: Users created before this change have no consent record; the app must not break for them (consent field is optional on the stored profile).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The login, registration, and reset-password pages MUST present a unified blue-themed visual identity (shared gradient background, brand mark, and control styling).
- **FR-002**: The login page MUST display the PK badge and brand mark and a white-outlined Google sign-in option.
- **FR-003**: The registration and reset-password pages MUST NOT display the legacy white toolbar header.
- **FR-004**: All existing authentication behaviors (email/password sign-in, Google sign-in, sign-up, email verification, password reset, sign-out, redirects) MUST be preserved unchanged by the redesign.
- **FR-005**: Brand design tokens and the primary accent color MUST be aligned to the blue family so that primary accents across the app are visually consistent with the auth screens.
- **FR-006**: Semantic colors (e.g., success green, error/destructive red) MUST be preserved and not recolored to blue.
- **FR-007**: The system MUST require explicit user agreement to the Terms & Conditions and Privacy Policy before creating a new account.
- **FR-008**: The system MUST block sign-up and inform the user when consent has not been given.
- **FR-009**: Upon successful sign-up with consent, the system MUST persist a consent record with the user profile capturing the agreement, the consent version, and the time of acceptance.
- **FR-010**: The consent record MUST be optional on existing user profiles so that pre-existing accounts continue to function.
- **FR-011**: The system MUST provide in-app Privacy Policy and Terms & Conditions pages reachable by route.
- **FR-012**: The system MUST provide an in-app "How to use PK" guidance page reachable by route.
- **FR-013**: On the AI assistant and one-to-one chat routes, the system MUST hide the global app header and bottom navigation and present a sticky conversation header.
- **FR-014**: Immersive conversation screens MUST provide a visible back control that returns to the previous screen (chat falling back to the messages list).
- **FR-015**: The global header and bottom navigation MUST reappear on all non-immersive routes.
- **FR-016**: The home screen MUST present the refreshed hero, intervention call-to-action, and action styling described in the redesign.
- **FR-017**: The bottom navigation MUST indicate the active tab with a solid blue pill and respect device safe-area insets.
- **FR-018**: Crisis-handling affordances in conversational surfaces (e.g., the "Talk to a Counsellor" path) MUST remain functional after the redesign.

### Key Entities *(include if feature involves data)*

- **User Profile**: Represents an authenticated account. Relevant attributes for this feature: identity fields (uid, email, display name, photo, email-verified) and an optional **consent** record.
- **Consent Record**: Proof that a user agreed to the Terms & Conditions and Privacy Policy at sign-up. Attributes: agreement flag, consent version, accepted-at timestamp. Belongs to exactly one User Profile.
- **Design Tokens / Theme**: The shared set of brand color variables and the primary accent that define the blue identity applied app-wide.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the auth pages (login, registration, reset-password) present the unified blue identity with no legacy toolbar headers.
- **SC-002**: 100% of new accounts created after this change have a stored consent record (agreement, version, timestamp); 0% of sign-ups complete without consent.
- **SC-003**: All pre-existing authentication flows pass verification with no behavioral regressions (sign-in, sign-up, reset, verification, sign-out, redirects).
- **SC-004**: On the AI assistant and chat routes, the global header and bottom navigation are hidden 100% of the time, and they reappear on 100% of non-immersive routes.
- **SC-005**: Privacy Policy, Terms & Conditions, and "How to use PK" pages are reachable and render their content on both web and Android.
- **SC-006**: Primary accent color is consistent (single blue family) across auth and post-auth screens, while semantic green/red are unchanged.
- **SC-007**: Crisis-handling affordances remain reachable and functional in conversational surfaces after the redesign.

## Assumptions

- This is a retroactive specification: the work described is already implemented on `redesign/auth-and-blue-theme`; the goal is accurate documentation, not new feature scope.
- The redesign is UI/UX and consent-capture only; no change to the underlying AI/RAG behavior, chat data model, or messaging logic is intended beyond layout and theming.
- Existing accounts predating the consent requirement remain valid; consent is enforced only at new sign-up.
- The exact blue palette values are an implementation detail; the requirement is a single, consistent blue brand family aligned to the auth screens.
- The current Terms/Privacy consent version is treated as the initial baseline (to be bumped when those documents materially change).
- Platform targets remain web and Android, consistent with the existing product.
