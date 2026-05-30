# Copy audit — plain language, no jargon

**Audience:** affluent, sophisticated business owners who are **not** tax or finance experts. Tone is confident and plain — never condescending, never jargon-laden (RATIONALE §19).

**Targets:** body copy at an 8th-grade reading level or lower; CTAs in plain verbs; every tax term either avoided or glossed in plain words on first use.

This audit covers **UI chrome strings** — the labels, headings, prompts, and microcopy hard-coded in `src/client/main.tsx`. It does **not** cover answer text returned by the model or lesson content authored by the BFF team (those flow from approved sources, not the interface).

## Rewrites

| Location | Before | After | Why |
| --- | --- | --- | --- |
| Prompt builder · Home Office | "What documents should I gather for **business use of home**?" | "What records should I keep for **using part of my home for work**?" | "Business use of home" is the IRS phrase; rewritten to plain words. |
| Prompt builder · Home Office | "How do I document an **Augusta Rule** rental?" | "How do I document **renting my home to my business (the Augusta Rule)**?" | Strategy name kept but glossed in plain words on first sight. |
| Suggested prompts | "How do I document an **Augusta Rule** rental?" | "How do I document **renting my home to my business (the Augusta Rule)**?" | Same gloss applied wherever the term surfaces. |
| Prompt builder · Hiring | "Should I **classify** this worker as a **contractor**?" | "Should I **treat this worker as a contractor or an employee**?" | "Classify" → plain; the real decision (contractor vs employee) made explicit. |
| Prompt builder · Hiring | "What should I confirm before **putting** family members **on payroll**?" | "What should I confirm before **adding** family members **to payroll**?" | Softer, plainer verb. |
| Plan intro | "When a task affects payroll, filings, or **entity setup**, bring it to Shona/Jay before acting." | "When something affects payroll, **tax filings**, or **how your business is set up**, check with Shona/Jay before you act." | "Entity setup" → "how your business is set up"; warmer verb. |
| Account · profile label | "**Tier**" | "**Access level**" | Product jargon → plain. |
| Account · profile label | "**Entity**" | "**Business type**" | Tax jargon → plain. |
| Account · profile label | "**Lifecycle**" | "**Your stage**" | CRM jargon → plain. |
| Account · profile label | "**Tags**" | "**Focus areas**" | System jargon → plain. |
| Account · security value | "Encrypted portal session with **source-grounded answers**" | "Encrypted session. Answers come straight from your **trusted lessons**." | "Source-grounded" → plain; split into two short sentences. |
| Entity fallback | "**Entity** details pending" | "**Business** details pending" | Consistency with "Business type". |
| Account eyebrow | "More" | "Account" | Matches the renamed nav destination. |
| Nav labels | "My Plan", "More" | "Plan", "Account" | Shorter, plainer (RATIONALE §1). |

## Terms reviewed and kept (with reasoning)

| Term | Decision | Reasoning |
| --- | --- | --- |
| "Estimated taxes" | Kept | The everyday phrase business owners already use for their quarterly payments; not specialist jargon. Glossed by surrounding copy ("before estimated taxes are due"). |
| "S corp" / business type values | Kept | A business owner knows their own entity type; this is *their* word, not ours. Shown as profile data, not asked of them. |
| "Payroll", "tax filings" | Kept | Common operating-business vocabulary; plainer alternatives ("paying staff") would read as condescending to this audience. |
| "Tax strategy guidance with receipts." (login H1) | Kept | "Receipts" is confident modern idiom for *proof*, not tax jargon; it sets the product's evidence-first promise. Reads as sophisticated, not jargon-y. |
| Answer-state labels ("Answer from approved sources", "Recommended for expert review", "Shona will find the answer") | Kept | Already plain; deliberately avoid "CPA", "citation", "low-confidence". |
| Admin console labels ("Strategy key", "AI Gateway", "Visibility tier") | Kept | Admin surface is used by the **BFF team**, not clients. Operator vocabulary is correct there. |

## Reading level

Body copy and CTAs were checked against an 8th-grade target. Representative samples:

- "Start with the question you'd bring to the call." — short, concrete, ~5th grade.
- "Check off what you have gathered." — imperative, plain.
- CTAs are all plain verbs: **Ask Shona/Jay**, **Send secure code**, **Mark complete**, **Run review checks**, **Ask about this**, **Try again**.

## Result

After the rewrites above, **no tax or financial jargon remains in client-facing UI chrome without a plain-language gloss.** Specialist terms survive only where they are (a) the client's own vocabulary about their own business, or (b) on the admin surface used by the BFF team.
