# Lessons Learned

## Layout & Offsets
- **Single Source of Truth for Padding**: When using a `fixed` global header, manage content offsets ONLY in `global.scss` or a single wrapper. DO NOT apply `padding-top` to both the `app-shell` and the `ion-content` as it results in double-offsetting.
- **Hero Page Exceptions**: Pages with "bleeding" backgrounds (Home, Profile) should use a `.no-header-offset` class on `ion-content` to set `--padding-top: 0` globally, but must handle internal content positioning (text/buttons) manually using internal `padding-top` or `margin-top` to clear the header.
- **Standard Padding Value**: For this project, the fixed premium header is `80px` high. A standard offset of `104px` (Header + 24px air) provides the best visual rhythm across all screens.
