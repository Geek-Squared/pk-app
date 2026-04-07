# Task: Fix Global Overlap and Layout Gaps

## 1. Research & Analysis
- [x] Inspect `Workbook` (my-work-book) page HTML/SCSS to identify double-padding
- [x] Inspect `Interventions` page HTML/SCSS for the same
- [x] Check `global.scss` vs component-level paddings
- [x] Verify if `ion-header` inside components is not hidden

## 2. Planning (Elegant Solution)
- [x] Define a standard padding-top for ALL pages that clear the header
- [x] Implement a utility class for "Hero" pages to bleed correctly
- [x] Ensure the side-menu doesn't conflict with transparency

## 3. Implementation
- [x] Re-align Workbook (my-work-book) page (Removed redundant top offsets)
- [x] Re-align Interventions page (Removed redundant top offsets)
- [x] Re-verify Home and Profile clearance (Managed via .no-header-offset and internal padding)
- [ ] Check other pages (Surveys, Feedback, etc.)

## 4. Verification
- [ ] Cross-page visual check (all screens mentioned)
- [ ] Check scrolling behavior on long lists
- [ ] Verify side-menu interactions

## Review section
- Double-padding found between `app.component.scss` (80px wrapper) and `global.scss` (80px content).
- Consolidated to a single `104px` global offset for standard pages.
- Applied `.no-header-offset` for pages that bleed (Home, Profile).
