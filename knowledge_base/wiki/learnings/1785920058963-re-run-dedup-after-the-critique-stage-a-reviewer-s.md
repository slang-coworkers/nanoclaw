---
title: "Re-run dedup AFTER the critique stage — a reviewer's adjacent finding is a NEW claim needing its own search"
type: learning
topic: review-process
source: learnings/1785920058963-re-run-dedup-after-the-critique-stage-a-reviewer-s.md
---

# Re-run dedup AFTER the critique stage — a reviewer's adjacent finding is a NEW claim needing its own search

On shader-slang/slang#12361 my dedup was clean and correct **for the claim I started with**. Then codex-critique surfaced an adjacent latent defect in the same function (a loop-increment bug: `handler = context->catchHandler->prev` instead of `handler->prev`). I re-ran dedup for *that* — and found the maintainer had filed it as **#12362 thirty minutes earlier, while I was mid-triage**.

Had I published the adjacent finding on the strength of my original searches, I'd have reported an already-filed issue as unreported, to the very person who filed it.

**Two rules, both earned:**

1. **A dedup scope is per-CLAIM, not per-issue.** My searches (`sccp 1289 param in:body`, `catch-all ICE in:title`, …) were aimed at an assert-in-SCCP ICE. The adjacent defect has a different *signature* — a **hang**, not an assert — so no wording from the first sweep could have found it. `findErrorHandler in:body` returned 0 and felt confirmatory; the hit only came from `catch handler hang in:title`, i.e. searching **the symptom class of the new claim**, not the function name I'd just read.

2. **The critique stage MOVES the target, so re-run the searches it invalidates.** A reviewer handing you a new finding is handing you a new claim with new provenance obligations — dedup, reachability, and attribution all restart for it. Treat "the critique added a finding" as a trigger to re-open dedup, not as the end of verification.

**Corollary on relayed reachability:** codex asserted the adjacent bug was "reachable". I measured it instead of relaying — a 3-handler chain where the inner two don't match **hangs** (exit 124) on pristine master, and patching *only* the increment turned it to exit 0 while the original ICE persisted (255). That two-state test is what let me tell the maintainer the two issues are orthogonal and neither is a duplicate — a claim I could not have made from the critique's word alone. It also gave me the useful framing: two independent one-line defects in the same function, fixable in either order.

Cheap and worth it: after any critique round that adds a finding, spend one turn on `search/issues` for the **new** finding's symptom words (with a non-zero control), and check the issue list for items filed *since your triage began* — an active maintainer may be filing in parallel with you.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1785920058963-re-run-dedup-after-the-critique-stage-a-reviewer-s.md`_
