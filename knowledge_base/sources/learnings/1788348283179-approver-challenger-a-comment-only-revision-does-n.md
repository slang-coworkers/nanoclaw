---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788201669194-g6v28y
written_at: 2026-09-02T11:24:43.179Z
---

# [approver/challenger] A comment-only revision does NOT resolve a prior revision's correctness flag; and a re-run primary "0 bugs" never rounds up over persistent independent secondary correctness flags on the core purpose

**Context.** shader-slang/slang#12840 went through 3 reviewable revisions. rev3 (3e977df9→38790ef3) was **comment/documentation-only** — the gate/collector/default logic was byte-for-byte unchanged. Yet the review-signal landscape shifted: the production claude-code-action review (which had gone stale on rev2) RE-RAN on rev3 and reported "🟡 0 bugs, 4 gaps … no correctness bug survived verification," while Devin (re-run) STILL reported the same 🔴 "Dynamic matrix conformances retain unknown layouts" and CodeRabbit ESCALATED 🟡 Moderate → 🟠 High ("can still choose column-major where CPU/CUDA/Metal need row-major; may skip specialize-only-arg cases").

**Two transferable rules.**

1. **Diff the revision before crediting it with a fix.** When a synchronize push arrives claiming to address prior review concerns, pull the incremental patch (`gh api repos/O/R/compare/<prev>...<new>`) and confirm whether the *flagged logic* actually changed. Here the incremental was comments only — so every rev2 correctness concern remained live. Do not let a freshly-green-ish primary, or the mere fact of "new commits + a maintainer LGTM," imply the concern was resolved. A reworded comment resolves a *clarity* gap, never a *correctness* gap.

2. **A primary "0 bugs" does not override persistent, independent secondary correctness flags on the PR's core purpose — it creates an ABSTAIN, not an approve.** The production review's cross-backend/correctness subagents cleared the code, but Devin AND CodeRabbit independently and persistently flagged the SAME specialize-only-arg / dynamic-conformance / cross-backend-default paths. Two independent tools converging on one mechanism, unrefuted by code change, is real doubt. Per "any doubt ⇒ ABSTAIN," the right call is ABSTAIN (reason CHALLENGER_CONCERN) — the primary's clearance is your prior, not a license to round up. (In #12840 the recorded reason was CLAUSE_FAIL:head_provenance because Step-1 clauses — fork head + red CI — short-circuit first; but the challenger conflict was noted so the human sees the abstain is robust independent of policy.)

**Corroborating hard signal.** CI ("SlangPy Tests") stayed red across all 3 revisions on a `pr: breaking change` (public matrix `L` param int→MatrixLayoutMode) — a plausible real downstream compat regression, exactly the kind of independent evidence that should stop an auto-approve regardless of what any single reviewer concludes.
