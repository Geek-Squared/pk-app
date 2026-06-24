# Positive Konnections Constitution

Positive Konnections (`pk-app`) is a mental health support app (Angular 20 + Ionic 8 +
Capacitor 8, Firebase backend). These principles govern how features are specified,
planned, and implemented. They are derived from the project's long-standing working
conventions (`.cursorrules`, `CLAUDE.md`) and supersede ad-hoc practice.

## Core Principles

### I. Spec-First, Plan-First
No non-trivial change (3+ steps or any architectural decision) begins without a written
artifact. Features flow through the spec-kit gates in order: specify → (clarify) → plan →
tasks → (analyze) → implement. Ambiguity is resolved on paper before code is written. If
work goes sideways mid-implementation, STOP and re-plan rather than pushing forward.

### II. Minimal-Impact Changes
Every change touches only what is necessary to satisfy the spec. Prefer the simplest design
that works (YAGNI); do not introduce abstraction, dependencies, or scope the spec did not
ask for. New complexity must be justified against this principle in the plan's Complexity
Tracking section.

### III. Root-Cause Discipline
No temporary patches, no laziness. Bugs are traced to their root cause and fixed to a senior
engineer's standard. When a fix feels hacky, stop and implement the elegant solution instead.
Ask: "Would a staff engineer approve this?"

### IV. Verification Before Done (NON-NEGOTIABLE)
A task is never marked complete without proof it works — run the relevant tests, build, check
logs, or demonstrate the behavior. Where it matters, diff behavior between `main` and the
change. "It should work" is not verification.

### V. Self-Improvement Loop
After any correction from the user, capture the pattern in `tasks/lessons.md` as a rule that
prevents the same mistake. Review relevant lessons at the start of work. The lesson log is
project memory, not a formality.

## Technology & Domain Constraints

- **Stack is fixed**: Angular 20 (NgModule-based, lazy-loaded routes), Ionic 8, Capacitor 8,
  Firebase (Firestore, Auth, Functions, FCM). Do not introduce alternative frameworks or
  backends without a constitution amendment.
- **AI/secrets boundary**: The frontend NEVER calls OpenAI directly. All AI runs through
  Firebase callable functions (`peekayChat`, `validateAiResponse`, `generateHeroAvatar`).
  `OPENAI_API_KEY` lives only as a Firebase secret, never in client code or `environment.ts`.
- **Layout rule**: Fixed premium header is `80px`; standard content offset is `104px`. Pages
  with bleeding backgrounds use `.no-header-offset` and manage positioning internally. Never
  apply `padding-top` to both the app shell and `ion-content`.
- **Mental-health safety**: This is a mental-health product. Crisis-handling paths (e.g. the
  `crisis` flag and "Talk to a Counsellor" affordance) are safety-critical — changes touching
  them require an explicit acceptance criterion in the spec and verification before merge.

## Development Workflow

- **Artifacts live where spec-kit expects them**: per-feature specs under `specs/<NNN-feature>/`
  (`spec.md`, `plan.md`, `tasks.md`); project principles in `.specify/memory/constitution.md`.
- **Gate order**: `/speckit-specify` defines WHAT and WHY (no implementation detail);
  `/speckit-plan` defines HOW against this constitution; `/speckit-tasks` derives ordered,
  checkable steps; `/speckit-implement` executes with verification per Principle IV. Use
  `/speckit-clarify` before planning when the spec is ambiguous, and `/speckit-analyze` before
  implementing to check cross-artifact consistency.
- **Legacy `tasks/` folder**: Existing `tasks/*.md` plans and `tasks/lessons.md` remain valid.
  `lessons.md` is the canonical lesson log (Principle V). New feature work uses `specs/`.

## Governance

This constitution supersedes other working practices. Every plan must verify compliance with
these principles, and any deviation must be justified explicitly in the plan. Amendments
require updating this file with a version bump and a dated note below. Use `CLAUDE.md` for
day-to-day runtime guidance; use this constitution for the non-negotiables.

**Version**: 1.0.0 | **Ratified**: 2026-06-24 | **Last Amended**: 2026-06-24
