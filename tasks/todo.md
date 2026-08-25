# Task: Logo-hue card accents on the blue theme

Goal: every card surface in the app carries a logo-derived hue on its **icon
chip**, while card bodies stay neutral and blue remains the structural /
action colour. Replaces the stashed full recolor (`stash@{0}`), which turned
the whole app cyan+coral.

## Design rules
- Hue lives on the icon chip only. Card bodies stay white/neutral.
- Blue (`--pk-primary`) stays the action colour: buttons, links, active states.
- Home is the one exception: its action pill matches its own tile's hue, since
  the six tiles are a fixed set with the `--card-inner-*` plumbing already there.
- Section hue is continuous with the Home tile that leads to it, so colour
  tells you where you are.

## Hue assignment
| Hue    | Section |
|--------|---------|
| coral  | **Urgency/crisis accent only** — not a section. The urgent badge and
           crisis states. Kept out of the section rotation so it never reads
           as "just another category". |
| amber  | My Workbook (+ its subpages) |
| cyan   | Messages (+ chat, group-details) |
| green  | Feedback (+ surveys) |
| purple | Referrals |
| teal   | Bookings |
| blue   | Interventions flow (chapters, posts, questions), Profile, AI
           assistant, auth pages — the primary journey stays in brand blue,
           continuous with the blue urgent tile that launches it. |

## 1. Tokens
- [x] Add `--pk-card-*` tint/ink pairs to `variables.scss` (lift from stash@{0})
- [x] Leave all existing blue `--pk-*` tokens untouched

## 2. Home
- [x] Retint the 6 feature tiles' chips to logo hues
- [x] Make each action pill inherit its tile's tint/ink
- [x] Main (urgent-variant) card -> coral; hero gradient left blue
- [x] Fix `--pk-secondary-dim` (undefined var on the Feedback tile)

## 3. Section pages
- [x] Interventions / chapters / posts / questions -> stay blue
- [x] My Workbook (page + chapters, question-answers, superhero) -> amber
- [x] Messages (+ chat, group-details) -> cyan
- [x] Feedback + surveys -> green
- [x] Referrals -> purple
- [x] Bookings -> teal
- [x] ProgressHeroCard component (left brand navy — see below)
- [x] Confirm profile + auth pages stay blue

## 4. Verification
- [x] `npm run build` clean
- [x] No remaining refs to undefined vars
- [x] Contrast: each tint/ink pair >= 7:1

## Review section

Done. 17 files, +142/-34. Blue theme untouched — this only adds logo hues to
icon chips.

**Token layer.** `--pk-card-{coral,amber,cyan,green,purple,teal}-{tint,ink,soft}`
in `variables.scss`. The stashed version's comment claimed every tint/ink pair
cleared 7:1; only purple actually did (the rest were 5.78–6.84). Inks were
darkened slightly — hues barely shift — and all six now measure >= 7.06:1.
`-soft` is the light end for gradient fills, white on it >= 5:1.

**Pages set `--pk-section-{tint,ink,soft}` once on `:host`** and point their
existing accent rules at it, instead of hardcoding hexes per file. Next
rebrand is a token edit, not another file sweep.

**Where hue landed:** Home tiles (amber/cyan/green/purple/teal + matching
action pills), Bookings header icon, Feedback header icon, Surveys chip +
hover border, Referrals avatar/glyphs/hover, Messages + chat avatars,
Workbook chapter status chips, Interventions category chips, Profile tonal
chips, Peekay avatar, ProgressHeroCard.

**Where blue stayed:** every button, link, focus ring and form state; all
headings; the Home hero gradient and urgent tile; the whole Interventions
chapter flow; auth pages.

### Judgement calls
- **Coral is not a section hue.** It's reserved for urgency/crisis — it now
  drives the urgent badge. Putting it in the section rotation would have made
  the crisis signal read as just another category.
- **Interventions stays blue** because its Home tile is the blue urgent card;
  making the section coral would have broken the tile->section continuity.
- **Status chips keep their meaning.** Workbook chapter states still read as
  solid (active) / tint (completed) / grey (locked); hue only says which
  section you're in, so no progress information was overwritten.
- **List pages use one hue for the whole section**, not per-row. Rotating hue
  across identical rows reads as noise.
- **ProgressHeroCard stays brand navy** in all three sections. It briefly
  inherited `--pk-section-*`, but that only ever recoloured the Workbook
  instance, which made one shared component look like two different things.
  Reverted on request. The logo hues stay on icon chips, which was the rule
  all along — the hero was the one place that broke it.

### Correction after sampling logo.png
The hues were inherited from the stash, which described them as "sampled from
the PK logo". Decoding the PNG and clustering its pixels showed that was only
partly true:

- The mark has **five** hues, not six: coral #d14546 (39% of coloured pixels,
  and the "POSITIVE" wordmark), purple #a06fa9 (21%, and "KONNECTIONS"),
  amber #f6c141 (17%), cyan #00accc (12%), green #a6ca64 (11%).
- **Teal was invented**, not sampled. It is kept as a deliberately derived
  sixth hue at 165° because six distinct section accents are needed and coral
  is reserved, but the comment now says so plainly instead of claiming the
  logo as its source.
- The inherited hues drifted from the real ones by up to 7.9° (coral and
  purple worst). All five are now locked to their sampled angle within 2°,
  with the contrast floors re-satisfied after rotation.

Saturation was deliberately NOT regenerated from the samples — a first attempt
that did so pushed purple to #7d238d, because the logo's purple is only 25%
saturated and boosting it to chip strength turns it magenta. Lightness and
saturation stay hand-tuned; only hue is locked to the file.

### Main card, v2 — light (current)
Seen on device, the filled coral card read as an error state. Every hue in the
logo sits at 54-61% lightness; the filled gradient ran 49% -> 34%, i.e. darker
and more saturated than anything in the mark. Hue was locked to 0.1 degrees
and that turned out to be the wrong property to optimise — lightness is what
carries "friendly".

Now a light card: coral tint background, coral-ink heading, solid coral-ink
icon chip and CTA. Hierarchy comes from size, tint and elevation rather than
saturation, and strong colour survives only in small areas where it means
"act" rather than "alarm". Filled coral is now genuinely reserved for crisis
UI, where the alarm register is earned.

Contrast: heading 7.19, body 5.55, chip and CTA 8.78. The card sits only
1.10:1 against the page surface, so its border and shadow are doing the
separation — worth checking on a real screen in daylight.

### Main card, v1 — filled coral (superseded)
The primary "Start Interventions" card moved from the blue gradient to coral —
the logo's dominant hue (39% of coloured pixels, and the "POSITIVE" wordmark),
and already the reserved urgency colour, which is exactly this card's job.

Its action pill had to change with it. The old `rgba(255,255,255,0.16)` wash
left the white label at **4.15:1** over the coral gradient — under the 4.5
threshold, and it was already marginal on blue. Inverting to a solid white
pill with coral ink measures 8.8:1 and matches how the standard tiles take
their own card's ink. The urgent badge inverted for the same reason: coral on
coral vanished.

The hero band above it is still blue. Left deliberately — a blue field behind
a coral primary card is what makes the card read as the main action. Worth an
eyeball; say the word and it can go warm too.

### Cleanup after the hero revert
- `my-work-book.page.scss`'s `:host` block existed only to cascade into the
  hero card; removed now that nothing reads it.
- `messages.page.scss` had a stale `#067994` literal for the avatar gradient's
  light end. It drifted when cyan was re-locked to its sampled hue
  (`--pk-card-cyan-soft` is `#067a90`), so it now reads the token instead.
- Other pages still declare the full `--pk-section-*` triple even where only
  one or two are read. Kept deliberately: it is a three-line per-page palette
  that documents the section hue, and trimming it means re-deriving values the
  next time something on that page needs styling.

### Follow-ups (not done)
- `--pk-{secondary,tertiary}-container`, `--pk-*-fixed*` and
  `--pk-on-*-container` are now dead — the Home tiles were their only
  consumers. Verified zero `var()` references in `src/`. Left in place in case
  you want to revert Home; safe to delete otherwise.
- `--pk-card-coral-soft` is unused (coral only needs tint/ink); kept so the
  set is complete.
- Not visually verified in a running app — build-verified and contrast-verified
  only.


---

# Task: Wire the Share App action

## What was broken
The Home "Referrals" tile's **Share App** button did nothing. It sits inside
the card's `routerLink="/referrals"`, so tapping it just navigated — there was
no click handler and no share code anywhere in `src/`. `@capacitor/share` was
not installed.

## What was done
- [x] `npm i @capacitor/share@^8` (matches Capacitor 8) — needed
      `--legacy-peer-deps`, see note below
- [x] `src/app/services/share.service.ts` — three-tier `share()` / `shareApp()`
- [x] `share` config block in `environment.ts` and `environment.prod.ts`
- [x] `HomePage.shareApp()` + `(click)="shareApp($event)"` on the button
- [x] Trailing chevron swapped for a share glyph (it no longer navigates)
- [x] `npx cap sync android` — plugin registered in Gradle
- [x] `npm run build` clean

## Three tiers, and why
| Platform | Path |
|---|---|
| Native Android | `@capacitor/share` -> system share sheet |
| Browser w/ support | `navigator.share` |
| Everything else | copy link to clipboard + toast |

The fallback is not decoration. `navigator.share` is a Chrome-on-Android API
and is **not implemented in the Android System WebView**, so a web build opened
in an embedded WebView never reaches tier 2. That is also why the Capacitor
plugin is required rather than just using `navigator.share` everywhere.

Dismissing the sheet is treated as a normal outcome, not an error — Capacitor
reports "canceled", the web API throws `AbortError`; neither shows a toast.
`share()` returns a `ShareOutcome` so callers can branch without try/catch.

## Needs a decision
- **The share URL is assumed.** Nothing in the repo defined one, so it defaults
  to the Play Store listing derived from the appId:
  `https://play.google.com/store/apps/details?id=com.positivekonnections.app`
  If the app is not published under that id, or there is a landing page or
  dynamic link to prefer, change `environment.share.url`.
- `--legacy-peer-deps` was needed, but the conflict is **pre-existing and
  unrelated**: `@capacitor-firebase/messaging@8.2.0` wants `firebase@^12.6.0`
  while `@angular/fire@20` pins `firebase@11.10.0`. There is no `.npmrc`, so
  this tree must already have been installed with that flag. Worth pinning in
  an `.npmrc` so installs are reproducible.

## Not done
- Not run on a device; the share sheet itself is unverified on hardware.

---

# Task: Wire the Call button (Referrals)

## Two bugs, not one
1. **The button had no handler** — `referrals.page.html:49`, no `tel:` link.
2. **Mobile never rendered it at all.** `.desktop-content` is
   `display: none` below 768px, so on the Android app — the primary target —
   the Call button does not exist. The `ion-list` mobile view shows the number
   as plain text with no action. Wiring only the desktop button would have
   fixed the platform almost nobody uses.

## And a third, found on the way
The `Referral` model declares `phone: string`; both templates read
`referral.phoneNumber`. `strictTemplates` is **off** in `tsconfig.json`, so
this compiled silently — and whichever name is wrong renders an empty number
rather than an error. Could not confirm the real Firestore shape from the
repo, so both fields are declared optional and read through a single
`phoneOf()` accessor that returns the first populated one. The templates now
show `'Not provided'` instead of a blank when neither is set, so the same bug
cannot hide again.

**This still wants confirming against Firestore** — if the field is settled,
collapse the interface back to one name.

## What was done
- [x] `Referral` interface reconciled (`phoneNumber?` + `phone?`, documented)
- [x] `phoneOf()` accessor; both views read through it
- [x] `call()` dials via `tel:` — Capacitor turns non-http schemes into an
      Android intent, so no plugin is needed and the web hands off to the OS
- [x] `toDialable()` keeps digits and a leading `+`
- [x] Desktop button wired, `[disabled]` when there is no number
- [x] **Mobile list given the call action it never had** (hidden when no number)
- [x] `aria-label` on both ("Call {name}" — the mobile one is icon-only)
- [x] `npm run build` clean

## Sanitiser behaviour
`'+263 77 123 4567'` -> `+263771234567`, `'(011) 234 5678'` -> `0112345678`,
`'N/A'` / `''` -> no number, so the affordance disables or hides.

One known gap: `'+27 (0)21 555 1234'` -> `+270215551234` keeps the trunk `0`,
which most carriers will reject. Stripping it heuristically is unsafe (a
trunk 0 is not reliably distinguishable from a real digit), so it is left as
stored — a data-entry issue to fix in Firestore, not in the client.
