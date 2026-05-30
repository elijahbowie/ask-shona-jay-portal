# Wireframes — Ask Shona/Jay

Low-fidelity, annotated SVG wireframes for every screen of the redesigned portal, desktop and mobile. They are intentionally grayscale and structural — they communicate information architecture, layout, and the **behavioral reasoning** behind each decision, not final visuals. The final visuals are the implemented app itself (run the dev server). Live verification screenshots were captured to `design/research/*.png` during the build but are not committed (regenerable; kept out of git to stay lean).

Each wireframe carries one or more inline annotation callouts that tie a region to a named principle in [`../RATIONALE.md`](../RATIONALE.md). One brand-sky accent marks the single primary action per screen (salience, RATIONALE §18).

Regenerate with: `node design/wireframes/generate.mjs`

## Index

| # | Screen | File | Behavioral rationale (one line) |
| --- | --- | --- | --- |
| 1 | Login — desktop | [01-login-desktop.svg](01-login-desktop.svg) | Progressive disclosure: ask for email first; the code field appears only after the email is accepted. |
| 1 | Login — mobile | [01-login-mobile.svg](01-login-mobile.svg) | Same flow stacked; full-width primary action sits in the thumb zone (Fitts's law). |
| 2 | Loading | [02-loading.svg](02-loading.svg) | Doherty threshold: a branded sub-400ms hold reads as "working," preventing a first-paint bounce. |
| 3 | Ask — empty, desktop | [03-ask-empty-desktop.svg](03-ask-empty-desktop.svg) | Choice architecture + fresh-start: suggested prompts and a clean canvas turn a blank box into one tap. |
| 3 | Ask — empty, mobile | [03-ask-empty-mobile.svg](03-ask-empty-mobile.svg) | Thumb-zone primary action; deadline cue surfaced above the fold. |
| 4 | Ask — answered, desktop | [04-ask-answered-desktop.svg](04-ask-answered-desktop.svg) | Peak-end + trust signaling: provenance before prose; a human-review offer that confirms rather than vanishes. |
| 4 | Ask — answered, mobile | [04-ask-answered-mobile.svg](04-ask-answered-mobile.svg) | Single-column answer; sources and next steps bracket the prose. |
| 5 | Ask — busy / skeleton | [05-ask-busy-desktop.svg](05-ask-busy-desktop.svg) | Shimmer skeleton + progress label set the expectation that an answer is forming. |
| 6 | Learn — vault, desktop | [06-learn-desktop.svg](06-learn-desktop.svg) | Endowed progress + Hick's law: seeded reading bars, short category filter. |
| 6 | Learn — vault, mobile | [06-learn-mobile.svg](06-learn-mobile.svg) | Single-column cards; search and filters stay reachable; bottom-tab nav. |
| 7 | Reader / lesson detail, desktop | [07-reader-desktop.svg](07-reader-desktop.svg) | Reading hygiene + progressive disclosure: ~700px measure; downloads above prose, related below. |
| 7 | Reader / lesson detail, mobile | [07-reader-mobile.svg](07-reader-mobile.svg) | Sticky back + Mark-complete; downloads docked above the body. |
| 8 | Plan, desktop | [08-plan-desktop.svg](08-plan-desktop.svg) | Implementation intention + goal-gradient: each item names a trigger; the meter climbs with each check. |
| 8 | Plan, mobile | [08-plan-mobile.svg](08-plan-mobile.svg) | Same checklist; progress banner pinned at top. |
| 9 | History | [09-history-desktop.svg](09-history-desktop.svg) | Recognition over recall: resume a thread without remembering the phrasing. |
| 10 | Account / More | [10-account-desktop.svg](10-account-desktop.svg) | Miller's 7±2: four destinations; secondary actions live one layer down. |
| 11 | Admin — Review Dashboard | [11-admin-review-desktop.svg](11-admin-review-desktop.svg) | Mode-specific design: dense metric grid + tight rows for fast triage. |
| 12 | Admin — Sources / Knowledge Ops | [12-admin-sources-desktop.svg](12-admin-sources-desktop.svg) | Upload → compile → review → publish; drafts never client-visible until published. |
| 13 | Admin — Wiki Review | [13-admin-wiki-desktop.svg](13-admin-wiki-desktop.svg) | Default-safe publishing: a draft sits visibly un-published until an admin acts (loss-averse gate). |
| 14 | Admin — Questions & Escalations | [14-admin-questions-desktop.svg](14-admin-questions-desktop.svg) | Escalations route fact-specific questions to a human — the safety net behind every AI answer. |
| 15 | Admin — Knowledge Health | [15-admin-health-desktop.svg](15-admin-health-desktop.svg) | Surfaces stale drafts and source gaps so content debt is visible before it reaches a client. |
| 16 | Admin — Settings | [16-admin-settings-desktop.svg](16-admin-settings-desktop.svg) | Read-only config; production secrets live in Cloudflare bindings, not the UI (least privilege). |
| 17 | States — empty / loading / error | [17-states-desktop.svg](17-states-desktop.svg) | Modeling + calm recovery: empty states show the first action; errors give a plain cause + one retry. |

## Coverage note

Mobile wireframes are provided for the full client flow (login, ask empty, ask answered, learn, reader, plan). Admin screens are desktop-only by design — triage and knowledge operations are desk tasks; the responsive implementation still reflows admin tables to two columns under 640px (see `styles.css` `.data-row` media query), but they are not primary mobile surfaces.
