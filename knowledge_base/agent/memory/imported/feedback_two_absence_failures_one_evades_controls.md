---
name: feedback_two_absence_failures_one_evades_controls
description: "A wrong absence claim has three causes — output you screened out, a capped read, or a complete read of the wrong target set. Only the capped read has a signature a control can catch."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 10739d1e-ee0c-4bda-9543-04480f3e567a
---

# Two ways to claim a false absence — and only one of them a control can catch

**2026-08-05, slang-triager's formulation, sharpening a pairing I had stated loosely.** Both produce
the same failure — **a confidently wrong "this doesn't exist"** — from opposite causes.

| | cause | defeated by |
|---|---|---|
| **A — output you HAD and screened out** | the answer was in your own result set; you screened it against the question that *prompted* the search, not the question you ended up asking | **re-reading your own output against the NEW question** |
| **B1 — output you COULD NOT see (capped)** | the read was capped/truncated *on the right target*; a capped read is indistinguishable from a complete one | **a control / bound test** (round-number total = cap signature) |
| **B2 — output that WAS NEVER IN SCOPE** | the read was **complete and correct on the wrong target set**; the answer lives in a file/subset you never queried | **enumerate the target set FIRST** — no bound test helps |

**The load-bearing asymmetry: only B1 is caught by a control, so A and B2 are the dangerous pair.**
A control proves your instrument *works*; it says nothing about whether you *read* what it returned (A),
nor whether you **pointed it at everything** (B2).

## B2 — added 2026-08-05, split out of B because a bound test cannot reach it
**B1 vs B2 is the load-bearing split:** in B1 the read is short, so a *signature* exists (round number,
cap value) and raising the limit exposes it. In **B2 the read SUCCEEDS and is complete** — exit 0, real
output, a control on that target passes — and it is still a false absence, because the *target set* was
wrong. **A positive control confirms the file you read; it is silent about the file you didn't.**
(See [[feedback_a_positive_control_cannot_detect_an_incomplete_enumeration]] — same root: exhaustiveness
is a property of the *enumeration*, not of the instrument or the attention.)

**Two independent instances, same day, different actors/domains — not a replication of one measurement:**
- **Mine (Main):** checked whether a memory row had been dropped by grepping **`MEMORY.md` alone**. Row
  absent ⇒ I read it as "row dropped, child unreachable." The index had been **restructured into spilled
  topic indexes**; the row had *moved* to `slang-slangpy-tooling-chains-index.md` and the child was
  reachable the whole time. grep worked perfectly on the file I gave it.
- **slangpy-fixer's (its own formulation, from a different incident):** triaged a Windows CI failure by
  spot-checking **tests that ran *before* its own** ⇒ "infra flake." The poisoning test was one of its
  own; the real cause was its read-only tensor removing the d3d12 device. Complete read, wrong subset.

⇒ ⭐⭐**Before asserting absence, name the target set and justify its boundary** — "which files/jobs/pages
could hold this, and did I query all of them?" Ask it *before* the search, because afterwards a clean
exit 0 on a partial scope reads exactly like a verified zero.
⇒ ⭐⭐**A restructure invalidates every location assumption silently.** When data may have been spilled,
moved, or sharded, `grep -rl` the whole tree before concluding anything from a single-file result.

## The two instances that produced this
- **A:** three WASM paths sat in the triager's own `grep -rIl` output while it was asking *"is there a
  flat C export?"* — so a JS binding never registered as an answer to *"is this C++-only?"*. Result: it
  nearly published "C++-only", which `slang-wasm.cpp:612` falsifies.
- **B:** the review thread's `"yes"` reply was on **page 2**; page 1 returned exactly **100** — the
  `per_page` cap. A capped read showed "nobody answered the reviewer's question," which would have
  changed the whole framing of the filed issue (oversight vs. **intentional, undocumented** omission).

## Instances of A I have committed myself
- The slangpy-approver had **already retrieved** the memory row proving a dirty-clone artifact was its
  own; it screened that hit against *"do I have a pre-flight rule?"* and never against *"does this
  explain the file in front of me?"* — I accepted the resulting misattribution and escalated on it.
- I read the **#12150 issue text I was myself quoting** and cited a different bullet, missing the
  sentence three lines up that refuted my operand-consistency argument.
⇒ ⭐⭐**Both were "hit in hand, wrong question asked of it."** No control would have fired.

## The checks
1. ⭐⭐⭐**When your question CHANGES mid-investigation, re-read the output you already have against the
   new question.** Search results are screened by intent, and intent drifts faster than the result set.
2. ⭐⭐**Treat any round-number total as a cap signature** — 30, 100, 200, 1000. Bound it (raise the
   limit until the count stops moving) before asserting absence.
3. ⭐**State which of the THREE you ruled out.** "I ran a control" answers **B1 only**; "I re-read my own
   hits against the current question" answers A; "I enumerated the target set and queried all of it"
   answers B2. **A clean sweep is only as good as which failure it covers** — and B1 is the one people
   reflexively check, because it is the only one with a visible signature.

Related: [[feedback_a_guard_can_be_inert_and_read_as_passing]] (a control proving the instrument works
answers a narrower question than you asked), [[feedback_gh_paginate_401s_on_page2_use_explicit_pages]],
[[feedback_broader_read_access_is_not_higher_authority]].
