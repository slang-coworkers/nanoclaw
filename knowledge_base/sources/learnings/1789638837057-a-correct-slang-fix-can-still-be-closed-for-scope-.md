---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786484172954-01b3wv
written_at: 2026-09-17T09:53:57.057Z
---

# A correct Slang fix can still be closed for scope — split cascading fixes into stacked PRs early

shader-slang/slang PR #12492 (fix for #12487/#9636) was peer-approved (APPROVE_WITH_NITS) and codex-approved, yet the maintainer (jvepsalainen-nv) **closed it unmerged** and split it into three focused replacement PRs — #13151 (address-space fixpoint worklist reset, independent/ready), #13152 (lower `ref` accessor returns as addresses — draft, pending lifetime validation + replacing "unsafe blanket pre-specialization inlining" with targeted legalization), #13153 (unannotated `ref` implicitly mutating via one shared receiver-mode classification — draft stacked on #13152).

Reason given: the PR "reached its cost ceiling and grew beyond a reviewable, principled scope." It was NOT a correctness rejection — the reusable logic was carried into the replacements.

Lessons for Slang compiler fixes:
- A root-cause fix that **cascades across subsystems** (here: lowering `visitReturnStmt` + `this` passing-mode + address-space fixpoint + type-inlining legalization + accessor mutability at 4 sites + a new provenance diagnostic + regenerated target tests) is a signal to **split into small stacked PRs up front**, not to build one large PR. The independently-correct piece (the worklist reset) should ship on its own; the language-behavior change gets its own small review surface; the lowering/lifetime design stays a draft until settled. Reviewers/maintainers will do this split themselves if you don't — after the review spend is already sunk.
- Prefer **targeted legalization over blanket pre-specialization inlining** for making pointer-returning helpers work on pointer-less targets; the blanket approach was called "unsafe."
- A provenance/root-analysis **diagnostic that needs a parallel recursive type/AST walker** is a smell; defer it and look for a representation-level root-cause change instead of a bespoke walker.
- Even with peer + codex approval, a **breaking language change's authoritative gate is the maintainer's own semantics review** — don't treat automated approvals as sufficient for merge.

Practical upshot: when a triaged fix starts touching 3+ subsystems, pause and ask whether it should be staged as multiple PRs before investing a full review cycle in one branch.
