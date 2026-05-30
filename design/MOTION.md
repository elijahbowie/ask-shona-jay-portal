# Motion inventory — Ask Shona/Jay

Motion is functional, not decorative. Every animation does one of four jobs (RATIONALE §17): **state change**, **continuity**, **attention**, or **affordance**. All motion honors `prefers-reduced-motion: reduce` — durations collapse to ~0 and transforms become no-ops (see `styles.css` reduced-motion block and the `main.tsx` motion effect, which calls `gsap.set(".motion-in, .reveal", { opacity: 1, y: 0 })` when the preference is set).

Motion tokens live in `tokens.css` (`--dur-*`, `--ease-*`). Durations zero out under reduced-motion.

## Inventory

| # | Element | Trigger | Effect | Duration / easing | Job | Reduced-motion |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Route content (`.motion-in`) | Route load / auth change | Fade + 18px rise, 40ms stagger | 500ms / `power3.out` (GSAP) | Continuity | Instant, fully visible |
| 2 | Learn cards (`.reveal`) | Scroll into view (`top 92%`, once) | Fade + 26px rise | 550ms / `power3.out` (GSAP ScrollTrigger) | Attention | Instant, fully visible |
| 3 | Latest answer (`.latest-answer`) | New answer rendered | Fade + 12px rise | 420ms / `--ease-out-expressive` (CSS keyframe) | Attention | Collapses to 0ms |
| 4 | Primary button | Hover / active | −1px lift + shadow step; press scales to .985; orb arrow nudges +3px | 160ms / `--ease-spring` | Affordance | No transition |
| 5 | Secondary / quick-action / download tiles | Hover | −1px lift, border → sky, shadow step | 160ms / `--ease-standard` | Affordance | No transition |
| 6 | Prompt cards / builder prompts | Hover | +3px slide-in, border → sky | 160ms / `--ease-spring` | Affordance | No transition |
| 7 | Learn / recommended cards | Hover | −2 to −3px lift, shadow step, border → sky-soft | 240ms / `--ease-out-expressive` | Affordance | No transition |
| 8 | Bottom-tab active indicator | Tab change | Sky bar scales in from 0 (`tab-pop`) | 240ms / `--ease-spring` | State change | Collapses to 0ms |
| 9 | Voice button | Listening | Pulsing sky dot (scale 1→1.6, fade) loop | 1s / `--ease-standard`, infinite | Affordance / state | Animation suppressed |
| 10 | Loading mark | App boot | Two concentric rings pulse outward (`orbital-pulse`) | 1.8s / `--ease-out-expressive`, infinite, 0.9s offset | State (working) | Animation suppressed |
| 11 | Answer skeleton | Busy / fetching | Shimmer sweep across placeholder lines | 1.4s / linear, infinite | State (working) | Animation suppressed |
| 12 | Login signal bars | Login hero mount | Bars scale-in from left, staggered (`signal-grow`) | 420ms / `--ease-out-expressive` | Attention (brand) | Collapses to 0ms |
| 13 | Reading progress bar | Progress change | Width transition | 420ms / `--ease-out-expressive` | State change | Collapses to 0ms |
| 14 | Readiness ring (conic) | Score change | Re-renders to new arc (`--score` deg) | n/a (value-driven) | State change | Static value |
| 15 | Skip link | Keyboard focus | Slides down into view from −160% | 160ms / `--ease-out-expressive` | Affordance (a11y) | Collapses to 0ms |
| 16 | Inputs / search box | Focus | Border → sky + focus ring | 160ms / `--ease-standard` | Affordance | No transition |
| 17 | Check button (Plan) | Hover | Scale to 1.08, border → sky | 160ms / `--ease-spring` | Affordance | No transition |

## Verification

- Confirmed live: route entrance stagger fires on each navigation; Learn cards reveal on scroll; the new answer card animates in; button/press micro-interactions respond on hover/active.
- Confirmed robust: scroll-linked reveals never gate content the user is waiting on — entrance animations always run on load, and `.reveal`/`.motion-in` default to visible in CSS so a JS failure degrades to fully-visible content.
- Confirmed reduced-motion: with `prefers-reduced-motion: reduce`, GSAP clears transforms and CSS zeroes all durations; no parallax, no infinite loops, no scroll-jacking.
