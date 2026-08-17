---
title: "[approver/critique-mustfix] Correcting a claim means sweeping the WHOLE file for the SUPERSEDED wording — grepping for your new phrasing cannot match the stale text it replaced"
type: learning
topic: review-approval
source: learnings/1785773722903-approver-critique-mustfix-correcting-a-claim-means.md
---

# [approver/critique-mustfix] Correcting a claim means sweeping the WHOLE file for the SUPERSEDED wording — grepping for your new phrasing cannot match the stale text it replaced

## Symptom

Two independent occurrences in a single turn (slang-rhi#800), one mine and one the orchestrator's, in separate memory stores:

- I corrected an overstated residency claim ("refuted" → "NOT cleared") with targeted edits, then grepped for my **new** wording to confirm the fix landed. It did. But the old claim was still live in the R1 and R2 historical sections, and in an embedded machine-readable JSON `notes` field a downstream parser would read. Only an adversarial reviewer's full end-to-end read caught them.
- The orchestrator corrected the same claim in two places, then a full re-read found it still live in **three** more — including an entire duplicate terminal section asserting "Devin's residency 🔴 stayed refuted through merge" and "not yet verified: whether `compute-indirect*.metal` printed PASSED", both disproved that same turn.

## Root cause — a verification asymmetry that feels like verification

After editing, the natural confirmation is to search for the wording you just wrote (`NOT-CLEARED`, `revision-ambiguous`). **That search cannot match the stale text, which uses the vocabulary you abandoned** (`refuted`, `STALE`, `VINDICATED`). A search for your correction is not a search for what it replaced — it confirms presence of the new claim while saying nothing about survival of the old one. Both of us ran a check that felt like verification and was structurally incapable of failing.

Two aggravating factors:

1. **Layered edits.** A file amended across several turns accumulates sections written under the old belief. Appending a correction at the top leaves the earlier layers asserting the superseded story — and the earlier layers are the ones a future reader hits first when scanning chronologically.
2. **Link-integrity checks pass the entire time.** Index regeneration and `[[link]]` validation verify structure, not prose. Every link resolved while the claims were wrong. If tooling regenerates index lines *from* per-file content, a stale line in the source propagates silently into the index.

## How to catch it

After any correction, sweep for the **superseded** term, not the new one:

```
# WRONG — cannot fail, tells you nothing about the stale text
grep -n "NOT-CLEARED" file.md

# RIGHT — sweep the abandoned vocabulary, expect ZERO hits
grep -nE "refuted|STALE|VINDICATED|CLEAN AGREEMENT|sole delta" file.md
# then a POSITIVE CONTROL so you know the pattern isn't vacuous:
grep -c "NOT-CLEARED\|revision-ambiguous" file.md   # expect > 0
```

The positive control matters — a zero-hit sweep is indistinguishable from a typo'd pattern. Verify the negative *and* prove the search works.

Also check, specifically:
- **Machine-readable fields** (embedded JSON, frontmatter `description`, headings, index lines). Prose corrections routinely miss these, and a parser recovers the rejected claim as authoritative.
- **Status tags** on historical sections (`[OPERATIVE]`, "join pending"). These were true when written and silently become lies.
- **Duplicate terminal sections** from separate append passes.

## Fix

Prefer **labelled invalidation over deletion** for an audit trail: keep the original text with an explicit banner ("HISTORICAL — invalidated at Rn; do not read as current fact"), naming what is withdrawn, why, and which statement controls. Rewriting history hides how the error propagated; a banner preserves it. When a file has been amended in enough layers that banners get unwieldy, rewrite it whole and consolidate to one terminal section.

For an already-published ledger row, re-record it (same key ⇒ replaces) rather than leaving the corrected reasoning only in prose.

## Why this matters more than an overstated message

A wrong message is read once; a wrong memory file is read by every future session and is the version that persists. In this case the surviving stale text was exactly the inference that had just been rejected over multiple critique rounds — so a future session would have confidently re-derived the error, with the correction sitting in the same file. Getting the durable record right is worth more than getting the outbound report right.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785773722903-approver-critique-mustfix-correcting-a-claim-means.md`_
