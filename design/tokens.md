# Design tokens — Ask Shona/Jay

Single source of truth for color, type, spacing, radius, motion, elevation. Implemented in `src/client/tokens.css` and consumed everywhere via CSS variables. Do not introduce raw hex values in component styles.

## Color — pulled directly from beyondfreedomfinancial.com

Extracted from the live site via DevTools computed-style sweep (recorded in `design/research/bff-palette.md`). Token names are semantic; raw values map exactly to the brand site.

### Surface (white + cool grays)

| Token | Value | Source on bff.com |
| --- | --- | --- |
| `--surface-canvas` | `#FFFFFF` | `--white` (page canvas) |
| `--surface-raised` | `#F7F9FC` | Derived 2-step warm-cool lift from `#F3F3F3` to read more "blue-leaning" |
| `--surface-sunken` | `#EEF2F8` | Derived from `#F3F3F3` for inset panels |
| `--surface-line` | `#E1E8F1` | Hairline divider on light |
| `--surface-overlay` | `rgba(0, 21, 50, 0.55)` | Modal/scrim, derived from navy `#001532` |

### Ink (text on light)

| Token | Value | Source |
| --- | --- | --- |
| `--ink-primary` | `#001532` | `--color-m3xbc5f1` — deep navy |
| `--ink-secondary` | `#3C4A63` | Derived mid-ink for body |
| `--ink-tertiary` | `#6B7891` | Derived for metadata |
| `--ink-quaternary` | `#9AA5BB` | Derived for placeholder |
| `--ink-on-brand` | `#FFFFFF` | White text on navy/sky |

### Brand blues

| Token | Value | Source on bff.com |
| --- | --- | --- |
| `--brand-navy-deep` | `#001532` | `--color-m3xbc5f1` |
| `--brand-navy` | `#002137` | `--color-m3xdljs7` |
| `--brand-sky` | `#3498DB` | `--color-m3xb1vli` — primary action |
| `--brand-sky-strong` | `#1E7FC0` | Derived darken of `--brand-sky` for hover |
| `--brand-sky-soft` | `#D7ECFA` | Derived tint for selected states |
| `--brand-cobalt` | `#155EEF` | `--cobalt` — secondary action |
| `--brand-link` | `#188BF6` | `--secondary` / `--link-color` |
| `--brand-mist` | `#E8F2FB` | Derived 92% tint for subtle backgrounds |

### Signal

Restrained accent set — used only where a behavioral cue is required.

| Token | Value | Use |
| --- | --- | --- |
| `--signal-success` | `#0FA67D` | Plan complete, source verified |
| `--signal-success-soft` | `#E0F4EE` | Success surface |
| `--signal-warn` | `#C77A0E` | Escalation pending / human-review |
| `--signal-warn-soft` | `#FBF1DC` | Warn surface |
| `--signal-danger` | `#C7344A` | Error |
| `--signal-danger-soft` | `#FCE5E9` | Error surface |

## Type

System: **Montserrat** for display (heading 700, supporting 500/600), **DM Sans** for body (400/500). Loaded once from Google Fonts with `display=swap` and a system fallback chain.

| Token | Value |
| --- | --- |
| `--font-display` | `'Montserrat', system-ui, sans-serif` |
| `--font-body` | `'DM Sans', system-ui, sans-serif` |
| `--font-mono` | `ui-monospace, 'JetBrains Mono', SFMono-Regular, monospace` |

Scale (modular, 1.25):

| Token | Size / line-height |
| --- | --- |
| `--type-d1` | 56 / 64 — hero only |
| `--type-d2` | 40 / 48 — page title |
| `--type-h1` | 32 / 40 |
| `--type-h2` | 24 / 32 |
| `--type-h3` | 18 / 26 |
| `--type-body` | 16 / 26 |
| `--type-body-sm` | 14 / 22 |
| `--type-meta` | 12 / 18 — uppercase eyebrows, letter-spacing 0.08em |

Weights: 400 body, 500 emphasis, 600 supporting heading, 700 display.

## Spacing — 4px base, t-shirt sizes

| Token | px |
| --- | --- |
| `--space-1` | 4 |
| `--space-2` | 8 |
| `--space-3` | 12 |
| `--space-4` | 16 |
| `--space-5` | 20 |
| `--space-6` | 24 |
| `--space-8` | 32 |
| `--space-10` | 40 |
| `--space-12` | 48 |
| `--space-16` | 64 |
| `--space-20` | 80 |
| `--space-24` | 96 |

## Radius

| Token | px |
| --- | --- |
| `--radius-sm` | 8 |
| `--radius-md` | 12 |
| `--radius-lg` | 18 |
| `--radius-xl` | 24 |
| `--radius-pill` | 999 |

## Elevation (shadow)

No glassmorphism. No drop-shadow excess. Three steps, all with a cool navy tint to feel native to the brand.

| Token | Value |
| --- | --- |
| `--elev-1` | `0 1px 2px rgba(0, 21, 50, 0.06), 0 1px 1px rgba(0, 21, 50, 0.04)` |
| `--elev-2` | `0 4px 16px rgba(0, 21, 50, 0.08), 0 1px 2px rgba(0, 21, 50, 0.06)` |
| `--elev-3` | `0 18px 48px rgba(0, 21, 50, 0.16), 0 2px 6px rgba(0, 21, 50, 0.08)` |
| `--elev-focus` | `0 0 0 3px rgba(52, 152, 219, 0.35)` |

## Motion

| Token | Value |
| --- | --- |
| `--ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` |
| `--ease-out-expressive` | `cubic-bezier(0.16, 1, 0.3, 1)` |
| `--ease-in-expressive` | `cubic-bezier(0.7, 0, 0.84, 0)` |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` |
| `--dur-instant` | `90ms` |
| `--dur-fast` | `160ms` |
| `--dur-base` | `240ms` |
| `--dur-slow` | `420ms` |
| `--dur-page` | `560ms` |

All motion respects `prefers-reduced-motion: reduce` — durations collapse to 0 and transforms become no-op.

## Layout

| Token | Value |
| --- | --- |
| `--content-narrow` | `680px` |
| `--content-prose` | `760px` |
| `--content-wide` | `1180px` |
| `--gutter-page` | `clamp(20px, 4vw, 56px)` |

## Forbidden

Do NOT introduce: cream, off-white (#FDF6E3 et al.), warm beige, paper textures, serif body type, purple-to-pink gradients, glassmorphism, lorem ipsum, abstract gradient blobs. See `design/RATIONALE.md` § Anti-slop guardrails.
