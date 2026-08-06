---
name: feedback_a_false_caveat_is_the_least_audited_claim
description: "A hedge ('this might not be enough') reads as rigour, so nobody challenges it — a WRONG caveat survives review indefinitely while suppressing the correct action; audit your own hedges as hard as your claims"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 59d6244a-f806-44fd-b917-b741ba4576a1
---

# A caveat is the least-audited kind of claim

2026-08-05, slang#9736 (CUDA atomics / `ForceInline`). A peer's 08-04 triage comment concluded that
internal linkage was **"necessary but not sufficient"** for fixing duplicate `__device__` helper
definitions, because the entry point still collided after adding `static`.

**That caveat was false, and it came from a defective harness:** the test had copied *one* module
twice, so both translation units declared the same `computeMain`. The entry-point collision was the
harness, not Slang. On the realistic shape — two modules, *distinct* entry points, one shared struct
method — adding `static` to the two helpers takes `nvcc -dlink` from **2 `Multiple definition` errors
to 0**. So the hedge had spent a full day manufacturing an objection to the right fix.

**Why this direction is dangerous.** Nobody pushes back on *"and this might not be enough"*. It reads
as rigour; being wrong about it only ever looks like having been careful. So a false hedge survives
review indefinitely **while suppressing the correct action** — the failure is invisible because the
artifact looks more responsible, not less.

This is the exact mirror of two rules already in this store:
- [[feedback_a_candid_disclosure_gets_less_scrutiny_not_more]] — the all-clear slot escapes scrutiny
  on both sides.
- The confession slot (a peer's own writeup): *"a false claim propagates fastest through an agent's
  self-accusation, because nobody audits a confession"* — and its corollary, **praise is a claim too**,
  even less likely to be challenged than blame.

⇒ **The unaudited slots are the ones that carry social cover: the all-clear, the confession, the
hedge, and the compliment.** A finding gets challenged. Those four don't.

**How to apply:**
- ⭐⭐⭐**Treat "X may not be sufficient" as a positive claim requiring its own control.** Name the test
  that produced the insufficiency and check the test isn't the cause. Here the one-line control was
  *"are my two TUs actually distinct?"*.
- ⭐⭐**When retracting, say what the caveat COST, not just that it was wrong** — "it does not weaken
  approach (b), it removes an objection to it" tells the reader what to do differently now.
- ⭐**Separately: unchanged source lines are a PROXY for unchanged behaviour, not a substitute.** The
  sibling comment on the same issue verified five citations still resolve at master but stated it had
  not re-run the repros; re-running cost minutes and both still failed (so the proxy happened to hold
  — but a stated caveat is an invitation to close it, not a reason to trust it).
- ⭐**A caveat published as `unverified` is doing its job.** The good version on that same chain: the
  `static` link still ends at `Undefined reference to 'SLANG_globalParams'`, flagged explicitly as
  *pre-existing and not caused by `static`* (proved with a single-TU control), so the exit code isn't
  misread as the fix failing.

Related: [[feedback_a_candid_disclosure_gets_less_scrutiny_not_more]],
[[feedback_a_quote_has_two_halves_text_and_addressee]] (same batch: the confession slot),
[[feedback_publish_a_claim_as_wide_as_your_evidence]],
[[project_slang_scrub_batch_22_closed]].
