---
title: "PR closed-unmerged ≠ rejected when a superseding same-repo PR merged the same change"
type: learning
topic: verification
source: learnings/1789072509032-pr-closed-unmerged-rejected-when-a-superseding-sam.md
---

# PR closed-unmerged ≠ rejected when a superseding same-repo PR merged the same change

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1788201582400-v7l2kt
written_at: 2026-09-10T20:35:09.032Z
---

# PR closed-unmerged ≠ rejected when a superseding same-repo PR merged the same change

**Rule.** When a PR is `closed & merged=false`, do NOT auto-map it to a REJECTED-equivalent outcome for approval-calibration / agreement-scoring. First check whether a **superseding PR merged the same change**. If so, the change was *accepted* — scoring it as rejected mis-calibrates an accepted change as a failure.

**Concrete case (2026-09-10).** shader-slang/slang#12840 ("Fix bug in matrix specialization", author fknfilewalker, a **fork** PR) was closed unmerged after 5 review revisions. It was superseded by same-repo **#12986** ("Fix matrix layout specialization by giving the layout its own type") — the *same change* — which merged the same day (by jkwak-work). The slang-pr-approver had returned ABSTAIN_POLICY (CLAUSE_FAIL:head_provenance) on all 5 heads; those are excluded from agreement scoring, so no false-safe. But a naive `closed & !merged ⇒ REJECTED` mapping would have recorded an accepted change as rejected.

**Why the fork-head ABSTAIN was substantively right, not just policy caution.** The change was a breaking one (`int → MatrixLayoutMode` retype) whose SlangPy CI ("SlangPy Tests") could only go green by coordinating a cross-repo companion fix (slangpy#1135) — via a workflow that cherry-picks the SlangPy PR (`slangpy_cherry_pick_pr`, added by slangpy#1143). **A fork PR cannot run secret-gated CI / that workflow** ("security setup reason"), so the maintainer had to recreate the fix as a same-repo PR to complete it. The `head_provenance` fork-head clause therefore *predicted the real completion blocker* — a fork PR was structurally unable to reach green here — rather than merely being conservative.

**Takeaways for anyone scoring PR outcomes or building the approval ledger:**
- `closed-unmerged` has ≥3 distinct meanings: rejected-on-merit, superseded/dedup (change accepted elsewhere), abandoned. Resolve which before mapping to a verdict outcome.
- For cross-repo breaking changes gated by secret-gated CI, a fork head is often a hard completion blocker, not a soft policy preference — the same-repo recreation is the expected path.
- Tooling gap observed repeatedly: the pr-approver has **no `record_human_verdict` tool**, so terminal human outcomes (merge/close/supersede) can't be joined onto the append-only `approval_decisions` ledger from the agent side — they get surfaced in chat instead. Ledger-based agreement metrics will be blind to these unless the human verdict is joined via the webhook path.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1789072509032-pr-closed-unmerged-rejected-when-a-superseding-sam.md`_
