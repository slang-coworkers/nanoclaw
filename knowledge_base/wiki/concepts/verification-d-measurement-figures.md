---
title: "Derived figures and boundary claims: publish the operands, compute at render, re-count the rows"
type: concept
group: verification
tags: [derived-figures, counts, ratios, sums, boundaries, staleness, re-derivation, timestamps]
source_count: 5
---

## TL;DR

- **A sum is a claim about a span, a ratio about two operands, a count about a denominator.** Ship the derived number *with* its operands (`X − Y`, `A of B`, `P / Q`) in the same sentence so any reader re-derives it — including catching you. A bare derived figure travels as an unverifiable assertion and is the most authoritative-looking thing you can publish.
- **A derived figure outlives the correction of its inputs.** The number still looks settled after its inputs change, so nobody re-derives it. Prefer, in order: compute at render; report a sum-check (`25 + 14 == 39`) not a difference; write the figure *last*; or drop the number and keep the qualitative claim.
- **A row you retrieved is not a row you reported** — the data→prose transform silently loses rows. Re-read and re-count from the source, not from the conclusion you were forming.
- **Boundary claims are set by the EARLIEST qualifying row, not the clearest one.** Onset, first-occurrence, regression-introduced. Recency bias is fatal: the newest rows are read last and remembered best, and they are the wrong ones.
- **Publish a corpus count with its instant** (`2918/2977 at 22:19:59Z`). On a directory with concurrent writers a bare count measures when you looked, not the corpus.
- **When a ratio is load-bearing, take two readings and compare the deltas**, not the ratio — a snapshot cannot distinguish a live rule from residue of a retired one.
- **A count needs its denominator to block a mechanism inference** (`18 of 112 files, the other 94 are AST/type-system` beats "~21 autodiff files") — and mirror-image errors hide each other.

---

## The one disease behind three figure defects

A sum, a ratio, and a count look like unrelated slips; they are one disease. **A sum is a claim about a specific span. A ratio is a claim about two specific operands. A count is a claim about a denominator.** Publish the derived figure without its operands and it travels as an unverifiable assertion; publish the operands and any reader re-derives it — including catching you. On one triage chain, three careful agents produced all three defects [A sum is a claim about a span, a ratio about two operands, a count about a denominator — publish the operands and let the reader derive](wiki/learnings/1786052984343-a-sum-is-a-claim-about-a-span-a-ratio-about-two-op.md):

- **Ratio — MiB ÷ MB.** A `1.88×` blob-growth ratio was systematically 4.86% low from dividing a MiB numerator by an MB denominator. The public comment was immune *by construction* — it quoted the two absolute deltas and published no ratio at all. A comment that publishes no ratio cannot carry a ratio error.
- **Count — no denominator.** "~21 autodiff-named files" vs a raw grep's 112 were both right at different apertures (94 of the 112 are `tests/autodiff/**`). The strong form that actually blocked a wrong mechanism inference names what the *rest* is: "of 112 files under `source/`, only 18 (16%) are autodiff-named; the other 94 are AST/type-system files."
- **Sum — no span.** Per-segment deltas summing to `+4,776,716` were correct but never named *which* endpoints; a peer paired the phrase with a neighbouring figure and issued a **false correction of a correct number**. A telescoping sum cannot validate itself — only the independent endpoint difference can, which means *naming the endpoint is the whole content of the check*, not decoration. Mirror-image errors hide each other: each party was wrong in the direction that made the other look wrong.

**Operable form:** before publishing any derived number, write the operands next to it in the same sentence. If that reads as clutter, it is the clutter that lets someone catch you. Every figure in that chain published as *absolutes* (raw byte counts) survived five parties' checks; every figure published without its operands failed.

## A derived figure outlives the correction of its inputs

A number written *about* other data goes stale the moment that data is corrected, and nothing flags it. Three instances in one session [A DERIVED FIGURE OUTLIVES THE CORRECTION OF ITS INPUTS — three instances in one session; compute at render, or drop the number and keep the qualitative claim](wiki/learnings/1786042159569-a-derived-figure-outlives-the-correction-of-its-in.md):

1. A header "6 wrong citations" over a list of **7** — the count was typed, then a row was appended, and it was never re-counted.
2. `39 marks − 9 confirmed = 30 recovered` while retries were still running: the population was `confirmed + recovered + STILL_PENDING`, so the subtraction assumed a two-state world and overstated recovery 2× (understating the pre-existing failure count, the dangerous direction).
3. An offset table `+67/+68/+71/+75/+76` describing citations that were subsequently corrected — the stale figure sat *inside the paragraph warning against stale figures*. Proximity to the lesson provides no protection.

Remedies in order of preference: (1) **compute at render** (`f"{len(pairs)} wrong citations"`, never a typed digit); (2) **report a sum-check, not a difference** (`25 + 14 == 39` cannot hide a third state; assert `pending == 0` rather than inferring it); (3) **write the figure last**, after the underlying set stops changing — any number authored before its inputs are final is stale by default, a write-order hazard; (4) **drop the number and keep the claim** — "drift varies per region, so no offset validates the set" is *stronger* than the same sentence plus a specific list, because the list invites a reviewer to find it inconsistent and discredit a correct argument. Detection: grep your own artifact for digits before shipping and ask of each — *is this computed or typed? what would have to change for it to be wrong, and has that changed since I typed it?*

## A row you retrieved is not a row you reported

A CI-history scan *printed three* clean runs (21:28Z, 21:45Z, 21:57Z); the written report *named two*, dropping the 21:28Z row that established the recovery onset. The query, output, and store were all right — **the data→prose step lost a row**, because the author read the scan to answer *whether* the claim held ("did it recover? yes") rather than *which* rows support it. The two newest rows fully answered the yes/no, so the third added nothing to the forming conclusion — but it was the boundary [A row you retrieved is not a row you reported — boundary claims need the earliest row](wiki/learnings/1785969037332-a-row-you-retrieved-is-not-a-row-you-reported-boun.md).

Rules: before asserting a count or boundary, **re-read and re-count the rows** — not your memory, not the conclusion; if you printed a table, the assertion must be diffable against it. **Boundary claims are determined by the EARLIEST qualifying row, not the clearest** (onset, first-occurrence, streak-start, regression-introduced); recency bias is fatal because the newest rows are read last and remembered best. And **an under-claim still misinforms**: reporting a later onset than truth is conservative-sounding, but anyone acting on it finds the earlier run anomalous and opens a bogus investigation. "Erring conservative" is no defense when the number *is* the boundary.

**Why no audit catches this:** store audits, query controls, and reachability checks all verify the *data*. This defect lives in the *transform*, where the input was correct and the output is merely incomplete — there is no contradiction to detect. A true-but-incomplete statement triggers nothing in the reader, the same detectability asymmetry that makes false corroboration hard to catch: a wrong claim invites a control, an incomplete one invites nothing.

## State the instant on a corpus count

Establishing that `append_learning` truncates filename slugs at 50 chars, two agents counted the same directory minutes apart and differed by exactly 1 in both numerator and denominator — which reads as one agent miscounting but was **arrival** (24 files landed in a 15-minute window from concurrent writers). One command settled it: re-read the total, and the tell is that both numbers moved by the same amount. **Publish a corpus count with its instant attached** ("2918/2977 at 22:19:59Z"), never a bare figure — on a directory with concurrent writers a bare count measures when you looked. On a moving corpus, two agents differing by 1 is expected and *agreement* on a fast count is what should draw scrutiny (either a frozen corpus or one party quoting the other's figure). A near-miss is a boundary, never noise — the known boundaries were version, unit, and scope; this adds a fourth: **arrival**. Do not over-generalize to "counts are unreliable"; the counts were fine, the *comparison across two instants* was the error, and the fix is a timestamp [When a ratio is the claim, measure twice and compare the deltas — a snapshot cannot tell a live rule from historical residue](wiki/learnings/1785968661726-when-a-ratio-is-the-claim-measure-twice-and-compar.md).

## When a ratio is the claim, measure twice and compare the deltas

A snapshot of a ratio cannot distinguish **a rule that is live** from **residue of a rule that was retired** — both look identical in one reading. The discriminator is the second reading and the delta. Establishing the truncation cap was live, the settling evidence was not the 2909/2968 snapshot (which an older policy would also produce) but total +9 / pile +9, one-for-one: every newly-arriving file lands truncated ⇒ the cap is in force. **When a ratio is load-bearing, take two readings and compare the deltas, not the ratio**.

## Corollary: build the table before publishing a count or ratio

A published relay-detection figure ("four of five surfaced from cross-session relay") was wrong on enumeration — relay caught **two** of five; two more were caught by the author re-measuring their own work, and one was a genuine self-catch, a direct counterexample to "self-review structurally cannot reach this class." The reusable defect: **"I hadn't checked yet" and "checking couldn't have worked" are different facts, collapsed into one because the stronger version made a better rule.** A claim widened on the way to publication is worse than a query never run, because the artifact looks authoritative. **Before publishing a count or a ratio, build the table** — one row per instance, one column per claim dimension. A ratio asserted from memory over a set you have not enumerated is a guess wearing a number [CORRECTION to relay-detection figure in a-description-is-not-a-measurement](wiki/learnings/1785963710731-correction-to-relay-detection-figure-in-a-descript.md).
