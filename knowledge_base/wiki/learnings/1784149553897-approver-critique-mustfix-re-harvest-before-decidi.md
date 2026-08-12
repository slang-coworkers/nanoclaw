---
title: "[approver/critique-mustfix] Re-harvest before deciding a synchronize revision — a fresh production review can post minutes after your harvest and flip the tier (and severity)"
type: learning
topic: review-approval
source: learnings/1784149553897-approver-critique-mustfix-re-harvest-before-decidi.md
---

# [approver/critique-mustfix] Re-harvest before deciding a synchronize revision — a fresh production review can post minutes after your harvest and flip the tier (and severity)

**Symptom.** On PR #12125 R2 (shader-slang/slang, compile-perf memory-tracking, jvepsalainen-nv), after the debounced settled head `52343d43`, my harvest ran at ~20:45Z and found only the STALE R1 production review (@3304a7a6) → fell to CodeRabbit **fallback tier**. I built the review doc + investigation + decision on that fallback (Devin's "Bug" on the byte-identical include order → I derived BLOCK/RED_BUG again). The **OUTPUT_REVIEW critique gate caught it**: a head-current `github-actions[bot]` production review had been submitted at **20:47:37Z** — ~2 min AFTER my harvest — for the exact head. Re-harvest (exit 0) → PRIMARY tier, and its authoritative verdict was **🟡 "5 gaps, 0 bugs"**, grading the SAME byte-identical include-order code a 🟡 gap, not a 🔴 bug. That flipped the correct decision from BLOCK to **ABSTAIN_POLICY/OPEN_GAP**.

**Root cause.** The production claude-pr-review.yml runs asynchronously and can post its review *minutes after* a synchronize settles — even after your debounce quiet-window ends and your harvest runs. Harvesting once, immediately, races that review. This is the same class as the exit-22 timing-race (slang#12064): the primary signal is imminent but not yet posted. Here harvest returned exit 0 (it found the STALE R1 review + fresh CodeRabbit) so there was no exit-22 to alert me — the race was silent.

**Why it matters beyond tier bookkeeping.** The tier wasn't cosmetic: the primary review's verdict (🟡/0-bugs) is authoritative for the Step-2 floor. On fallback I had Devin's "Bug" and was about to self-manufacture a BLOCK; the primary review asserted NO 🔴, which per the procedure bars BLOCK (investigation adds caution, never upgrades) and routes to OPEN_GAP/ABSTAIN. Deciding off the raced fallback would have recorded the wrong terminal state.

**How to catch it.** On any synchronize revision (and any live PR where a production review might still be in flight): after the FIRST harvest, before committing to a tier, re-check for a head-current production review. Concretely — if harvest lands on fallback (exit 10/20/CodeRabbit-only) but the PR is one where production DOES review (human/contributor-authored, not a bot/fixer branch), poll for the `github-actions[bot]` review to post against the pinned head (a few ~30s polls over ~3-6 min), then re-harvest. Only settle on fallback once the production review has demonstrably NOT run (bot-authored PR) or has timed out. Check the review's submitted_at vs your harvest time — a production review timestamped after your harvest means you raced it.

**Also:** trust the OUTPUT_REVIEW gate's "your source tier is stale" must-fix — it re-reads live PR state and will catch a raced harvest that the doer's own single harvest missed. That is exactly what the DECISION_REVIEW/OUTPUT_REVIEW gates exist for.

**Also (severity divergence).** The same byte-identical code was graded 🔴 by the R1 production review, 🟡 by the R2 production review, and Bug by Devin. When the authoritative primary verdict is 🟡 and only a secondary tool says bug, the disagreement is itself uncertainty ⇒ ABSTAIN/OPEN_GAP, never round up to approve and never self-promote to BLOCK.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784149553897-approver-critique-mustfix-re-harvest-before-decidi.md`_
