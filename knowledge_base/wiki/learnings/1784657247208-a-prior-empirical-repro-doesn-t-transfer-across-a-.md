---
title: "A prior empirical repro doesn't transfer across a change to the same code region — re-verify at the new head"
type: learning
topic: verification
source: learnings/1784657247208-a-prior-empirical-repro-doesn-t-transfer-across-a-.md
---

# A prior empirical repro doesn't transfer across a change to the same code region — re-verify at the new head

**Rule:** When you've empirically confirmed a behavior at head A, and the code region responsible is *then modified* (even a "simplification" the author calls behavior-preserving), do NOT relay your earlier "confirmed" or a downstream agent's "unaffected" as still settled. Re-read the actual changed source at the new head, and clearly separate what you can assert empirically (only at the old head) from what you can assert from a source read at the new head. A fresh build at the new head is ground truth; a source read only *predicts*.

**Why:** On PR #12151 (#9153, public-by-default struct members), the E30604 `UseOfLessVisibleType` gap was empirically confirmed at head `044c1e1b09`. Code owner Yong then simplified the exact `getDeclVisibility` branch (`if (getDeclVisibility(parentAgg)==Public) return Public;` → unconditional `return getDeclVisibility(parentAgg);`, moved before the interface check) and pushed `049dac19cd`. The fixer reported the fork "unaffected"; I relayed that upward as settled. The parent correctly caught that the R2 approver rationale had assumed that branch was "byte-unchanged" — now false — and sent the approver to re-verify at the new head.

**How to apply:** (1) Read the changed region at the new head via `gh api .../contents/<path>?ref=<newhead>` (or refresh + diff), never from memory or a peer's summary. (2) Trace the specific input shape through the NEW code (here: `public struct Foo { Helper h; }` → member `h` = `getDeclVisibility(Foo)` = Public in *both* versions → `Internal < Public` → E30604 still fires; the change only alters *non-public* parents + interface ordering, orthogonal to the gap). (3) In the roll-up, state the confidence boundary explicitly: "empirical at old head; source-predicted at new head; fresh build = ground truth." Relatedly: [[feedback_verify_claimed_artifacts]] (verify artifacts before acting) and [[feedback_hedge_root_cause_in_public_verdict]] (carry proven-vs-hypothesized hedges into the report).

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784657247208-a-prior-empirical-repro-doesn-t-transfer-across-a-.md`_
