# Design rationale — behavioral science driving every decision

This document ties each meaningful design decision in the Ask Shona/Jay portal to a named behavioral-science principle. Every interactive element on the screen has a job; if a button, panel, or animation cannot be defended below, it is removed.

The audience: affluent business owners who are sophisticated operators but **not** tax/financial experts. They are time-poor, action-oriented, and skeptical of vague advice. Every screen has to answer two questions fast: *"What can I do right now?"* and *"What will it cost me if I get this wrong?"*

---

## 1. Primary navigation — Hick's Law + Miller's 7±2

**Decision.** Client navigation collapses to four destinations: **Ask**, **Learn**, **Plan**, **Account**. Admin gets six, denser, because triage workflows need access to many slices at once.

**Principles.**
- *Hick's Law*: choice time grows with the log of options. Cutting nav from 6 to 4 client items measurably shortens the "where do I go" moment that follows every login.
- *Miller's 7±2*: short-term capacity caps around five items. Four leaves headroom for the bottom-tab mobile pattern and the user's own working memory.

**Trade-off.** "History" and "More" used to be siblings — now History lives inside Account. Cost: one extra tap to reach old questions. Benefit: every visit greets the user with the four jobs they care about, not the eight things the app *can* do.

---

## 2. Ask is the default route — Goal-gradient + Fresh-start effect

**Decision.** Login lands directly on **Ask**, with the text input already focused and a single deadline cue visible. The four suggested-prompt cards are the first interactive elements the eye reaches.

**Principles.**
- *Goal-gradient effect*: motivation rises as the goal feels closer. The visible prompt cards prove "the answer is one click away," which removes the typical "what do I even ask?" stall.
- *Fresh-start effect*: a clean canvas signals a new chance to be on top of taxes. The empty answer panel reads as opportunity, not absence.

---

## 3. Suggested prompts before free text — Choice architecture + Cognitive load

**Decision.** Above the text input we show four personalized prompt cards (drawn from the user's tags, entity type, lifecycle). Below the input lives a categorized prompt builder (`My Business`, `My Family`, `Tax Deadlines`, `Savings`, `Hiring`, `Home Office`).

**Principles.**
- *Choice architecture*: defaults steer behavior without removing freedom. Smart prompts beat a blinking cursor for time-to-first-question.
- *Cognitive load (intrinsic vs. extraneous)*: phrasing the question is **extraneous load** for non-experts. By offering tested phrasings we shift load off the user and onto the system.

---

## 4. Tax-readiness ring — Goal visualization + Implementation intention

**Decision.** The Ask sidebar shows a circular readiness score with a one-sentence interpretation and a "Why this score?" disclosure. The score is *descriptive*, never a gate.

**Principles.**
- *Goal visualization*: visible progress drives persistence. A 73 looks like a target you can move; "fair" does not.
- *Implementation intention*: the "Why this score?" reveal names the specific input that would move the number — converting a vague "do better" into "add your entity type."

**Trade-off.** A score is a simplification — could be misread as a qualification. Mitigated by the always-visible caption: *"This is a planning signal, not a qualification decision."*

---

## 5. Deadline card with countdown — Loss aversion + Temporal landmarks

**Decision.** A persistent card in the Ask sidebar shows the **next tax deadline** with days remaining and a one-click "Ask about this" CTA that pre-fills the question.

**Principles.**
- *Loss aversion*: losses feel ~2× larger than equivalent gains. Days-until-penalty framing outperforms days-until-completed framing.
- *Temporal landmarks*: anchoring effort to a near-future date raises follow-through. Quarterly tax deadlines are natural landmarks for this audience.

---

## 6. Source citations before the answer body — Trust signaling + Anchoring

**Decision.** Each answer shows a small "Built from the Beyond Freedom strategy library" trust bar **above** the prose, followed by inline citation chips. Sources expand into cards beneath the answer.

**Principles.**
- *Trust signaling*: pre-disclosed provenance reduces motivated skepticism, especially for advice that costs money to act on.
- *Anchoring*: the first thing the eye lands on sets the frame. Anchoring on *cited* establishes the answer as evidence, not opinion.

---

## 7. "Want Shona to review this personally?" CTA on every answer — Default bias + Safety net

**Decision.** Every answer card surfaces a single human-review CTA with a stated SLA ("Usually within 4 hours"). Once pressed, the CTA flips to a calm confirmed state rather than disappearing.

**Principles.**
- *Default bias*: leaving the escalation visible (rather than buried in a menu) makes asking for help the path of least resistance — the right behavior for fact-specific decisions.
- *Peak-end rule*: the *end* of an interaction colors the whole memory of it. Ending an uncertain answer with "your case is now with Shona's team" lifts perceived quality of the entire visit.

---

## 8. Follow-up prompt suggestions — Zeigarnik + Decision fatigue

**Decision.** Below each answer, three context-aware follow-up prompts appear as one-tap buttons.

**Principles.**
- *Zeigarnik effect*: open loops nag at attention. By giving the user three sharp ways to close the loop, we redirect that nagging energy into productive next moves instead of doom-scrolling.
- *Decision fatigue*: by the third question of a session, the user's choice-quality drops. Pre-composed follow-ups carry the load for them.

---

## 9. Plan checklist — Implementation intention + Goal-gradient

**Decision.** The Plan page renders profile-driven tasks as a checklist with a progress meter at the top. Each item carries a "when you are ready, gather X, Y, Z" implementation cue.

**Principles.**
- *Implementation intention*: "when X happens, I will do Y" plans are roughly 2-3× more likely to be executed than vague goals. Each item explicitly names the trigger and the action.
- *Goal-gradient*: progress bar climbs visibly with every check — the closer to 100%, the harder it is to walk away.

---

## 10. Library card progress ring — Completion bias + Endowed progress

**Decision.** Each Library card shows a thin reading-progress bar that begins seeded for any page the user has scrolled into.

**Principles.**
- *Endowed progress*: tasks where progress is already underway are completed at significantly higher rates than tasks starting at 0%. By marking even a single paragraph of scroll, we move users out of "not started."
- *Completion bias*: incomplete bars draw the eye more than complete or empty ones.

---

## 11. "Continue reading" rail above the grid — Recognition over recall

**Decision.** When the user has any partial reading, the Library page shows a single full-width "Continue reading" card at the top with title and percent.

**Principles.**
- *Recognition over recall*: the user does not have to remember where they were — the system shows them.
- *Memory consolidation*: returning to in-progress material within 24-72 hours is the right window for retention; we prioritize resuming over starting new.

---

## 12. Personalized "Recommended for you" band — Social proof + Personalization

**Decision.** Above the search grid, four cards are surfaced based on the user's profile (entity type, tags, lifecycle). Each card states the *reason* it was selected.

**Principles.**
- *Social proof / authority*: a curated set from the advisors carries more weight than search-it-yourself.
- *Personalization (without manipulation)*: showing the reason ("recommended because you have a single-member S-corp") preserves transparency.

---

## 13. Reader page — Progressive disclosure + Reading hygiene

**Decision.** Reader pages are a single column at 680-760px max width, with a downloads panel docked above the body, related pages at the foot, and a sticky top bar that holds **Back** and **Mark complete** only.

**Principles.**
- *Progressive disclosure*: downloads (the action) and related (the next step) bracket the prose; sidebars and chrome stay out of the way during reading.
- *Reading hygiene*: 60-75 character measure is the optimum for sustained prose comprehension.

---

## 14. Voice input on Ask — Reduce friction at point of capture

**Decision.** A "Voice note" affordance sits next to the submit button, expanding into a soft pulse while listening.

**Principles.**
- *Friction reduction*: a busy operator on a phone between meetings will not type a paragraph; they will speak it.
- *Affordance signaling*: the pulse animation makes the listening state unambiguous and matches the physical world's "mic is hot" mental model.

---

## 15. Empty states — Endowed progress + Modeling

**Decision.** Empty states never just say "nothing here." They show the first action the user should take and one sentence about what will appear after they do it.

**Principles.**
- *Modeling*: showing what a populated state will look like (a stub card with greyed-out text) primes the user to fill it.
- *Endowed progress*: a stub card reads as "started," reducing the activation energy.

---

## 16. Admin dense layout — Speed of triage

**Decision.** Admin pages adopt a denser grid (16px row height, two-column metric panels, table-style row scanning) and lose the soft cards used on the client side.

**Principles.**
- *Mode-specific design*: admin users are doing scanning and triage; client users are doing learning and asking. Information density is the right answer for one and the wrong answer for the other.

---

## 17. Motion — Functional, not decorative

**Decision.** Motion is reserved for four jobs: (1) **state changes** (button press, escalation sent), (2) **continuity** (route transitions that preserve mental position), (3) **attention** (the new answer slot pulses briefly when filled), (4) **affordance** (voice listening pulse).

**Principles.**
- *Change blindness*: humans miss state changes that lack motion. A 200ms cross-fade on the escalation CTA is the difference between "did it work?" and "I see, it worked."
- *Spatial continuity (object permanence)*: route transitions that slide rather than cut help users keep a mental model of where they are.

**Reduced-motion fallback.** All durations collapse to 0 when `prefers-reduced-motion: reduce` is set; opacity and color transitions remain instantaneous.

See `design/MOTION.md` for the full inventory.

---

## 18. Color discipline — Brand-true and restraint

**Decision.** Surfaces are **white + cool grays**. Text is **deep navy**. Primary action color is **sky blue `#3498DB`**, used for one CTA per panel. Signal colors (success/warn/danger) appear *only* when behaviorally required — never as decoration.

**Principles.**
- *Salience theory*: when everything is loud, nothing is. Reserving the sky blue for one action per view makes that action unmissable.
- *Brand-aligned trust*: the user has seen these blues on the marketing site; consistency raises perceived legitimacy of the portal.

---

## 19. Plain-language copy — Cognitive load + Trust

**Decision.** Reading-level target is 8th grade for body, plain-language for CTAs. Tax/financial jargon is rewritten (`QBI deduction` → `the small-business income deduction`, `Augusta Rule` → `Augusta Rule (renting your home to your business)`).

**Principles.**
- *Cognitive load*: jargon imposes extraneous load on non-experts.
- *Trust*: the perceived honesty of a source rises when the source uses the audience's vocabulary, not its own.

See `design/COPY.md` for the before/after table.

---

## 20. Anti-slop guardrails — Brand integrity

The following are explicitly forbidden in this codebase. Each ban has a reason; this list is enforced in code review and via grep at verification time:

| Banned | Why |
| --- | --- |
| Cream / off-white / paper textures | Off-brand; warm neutrals fight the navy/sky palette and read as "AI editorial template" |
| Serif body type | The brand uses DM Sans body and Montserrat display. A magazine serif rewrites the brand. |
| Purple → pink gradients | Generic AI tell; off-brand. |
| Glassmorphism by default | Trendy; impairs legibility for older eyes; off-brand. |
| Lorem ipsum | We have real copy. Placeholder copy is always a sign of "we didn't think about this screen yet." |
| Abstract gradient blobs | The most-shipped AI imagery cliché. Replaced with structural geometry that derives from the BFF logo mark. |
| Emoji as decoration | Allowed inside user-generated content only; never in UI labels or CTAs. |
| "AI-generated illustration of [thing]" | All imagery must serve a wayfinding or trust purpose. |

---

## How this document is used

When adding or modifying a screen, the author must be able to point at the principle their design is honoring. If a contributor cannot name the principle, the design is not ready.
