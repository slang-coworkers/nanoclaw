---
title: "Name the field that would falsify you, in advance — caution re-checks something, naming re-checks the right thing"
type: learning
topic: misc
source: learnings/1785799355770-name-the-field-that-would-falsify-you-in-advance-c.md
---

# Name the field that would falsify you, in advance — caution re-checks something, naming re-checks the right thing

## The procedure

Whenever you record a conclusion that depends on mutable state, **name in advance the specific field whose change would invalidate it.** Then re-read *that field* at the moment of action.

This is not the same as "be careful" or "re-verify before acting." Caution makes you re-check *something*; naming the field makes you re-check **the thing that decides**.

## Three instances of the identical discipline, one day (2026-08-03)

The same shape showed up at three different layers, and in each case the win came from naming the discriminator *before* the evidence arrived:

1. **Testing** — *name the defect, then name the assertion that fails when only that defect is reintroduced.* Without it you get a vacuous test: an assertion on `parent_index` that a phantom-slot bug could not move, which passed with the fix fully neutered.
2. **State/permission** — *name the field that expires your premise.* On slang#12281 the fixer checked for an approval, found none, and explicitly recorded that the finding would expire the moment one landed — naming `reviewDecision` / the approval's `commit_id` as the fields to re-read. An approval landed ~90 minutes later. Because the field was named, the webhook was immediately interpretable: merging master would now dismiss a five-round approval, so the correct action became *nothing*.
3. **Triage** — *name the escalation before the second failure.* Facing one macOS `mtl` test failure, it pre-committed: "if the same single test fails again, that is an environmental flake to escalate, not to re-attribute." Naming it in advance is what prevents the second data point from being rationalized into whatever you already believe.

## Why "caution" is not a substitute

A cautious agent re-reads the PR, sees green CI and a plausible summary, and proceeds — having verified real things, none of them the deciding one. In each case above, the deciding field was narrow and specific (`reviewDecision`; the assertion's observable; test-identity across runs). Breadth of re-checking does not converge on it; naming does.

Corollary: when a probe *cannot* see the deciding field, say so instead of substituting a readable one. `mergeable_state` tells you **that** a requirement is unmet, never **which** — so reading it is not a diagnosis, and an inference built on it ("behind ⇒ merge master next") is an unverified cause dressed as a plan.

## The disposal half

A conclusion whose premise expired must be **closed, not annotated**. On the same PR, the index still read *"`behind`: MERGE master, never rebase"* — correct when written, wrong within the hour. A stale *"do X next"* is the most dangerous form of stale memory, because a fresh context executes it without re-deriving. The fix that generalizes: **fold per-item instructions into one shared rule** (#12281 + #12186 now share a single line: any commit dismisses the approval; `behind`/`blocked` is the maintainer's via "Update branch"; a CI rerun spends no commit so it stays allowed). One rule can't go stale per-item.

Related: [Control the control], [A control that doesn't fire may mean you misunderstood the bug], [A correct DEAD marker plus a stale live-work duplicate is worse than no entry], [`mergeable_state` tells you that, never which].

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785799355770-name-the-field-that-would-falsify-you-in-advance-c.md`_
