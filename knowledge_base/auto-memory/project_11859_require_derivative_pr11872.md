---
name: #11859 [require] on derivative over-propagates — PR #11872 design RESOLVED
description: Regression PR #11872; expipiplus1 approved+self-readied+is directly editing the PR that inverts his own #8144 test → use-site propagation intended; both Copilot threads settled by him; held, bot-merge operator-gated
type: project
originSessionId: 92bbd672-c3e5-444f-b52c-1c7d3637e748
---
#11859: a user-defined derivative's `[require]` was propagated unconditionally onto the primal (regression from #11524 fwd + #11558 inverse), so a plain non-diff primal call failed E36107 on an unrelated target. Fix = Approach A — move the requirement from the primal to the `fwd_diff`/`bwd_diff` use-site, gated on the derivative carrying an explicit `[require]`. Draft PR **#11872** (branch `fix/issue-11859`), `report_pr_created` done, `pr: non-breaking`.

**Design question RESOLVED (verified 2026-07-01):** the PR inverts expipiplus1's OWN #8144 regression test (which asserted the opposite premise — that the requirement propagates to the primal). expipiplus1 — author of #11524 AND of #8144 — himself flipped the PR `ready_for_review` (10:58:22Z), requested Copilot, then **APPROVED** (10:59:39Z, empty body, review 4608224298). So use-site propagation IS the intended model.

**Why / how to apply:**
- Non-draft state is a **maintainer action, NOT a drafts-only breach** — do NOT flip it back to draft (would override the maintainer). Fixer's "still draft-only" report was stale.
- **expipiplus1 is directly driving the PR** (07-01 ~11:49Z): readied it, approved it, then **pushed commit `87f6ad1b8`** ("Use derivative name location for capability provenance note" — the `getNameLoc()` fix for Copilot #2, with a `Decl::loc` fallback) and **resolved BOTH Copilot review threads** (#2 because he fixed it; #1 because he accepted the deferral). Fixer fast-forwarded its worktree to `87f6ad1b8` (clean ff, its commit is the parent), did nothing to the PR, correctly read his commit-note as informational (no reply). **Never force-push over the maintainer's commit;** rebase any future must-fix onto it. The "#2-batch" plan is moot.
- Copilot finding #1 (`visitStaticMemberExpr` at :1163 traverses only `declRef.declRefBase`, not `baseExpression` → a primal's OWN `[require]` at a `primal.bwd_diff` site isn't propagated) is REAL but **pre-existing (HEAD^)** and **out of #11859's scope** → filed tracking issue **#11882**; fixer replied on Copilot's #1 thread (discussion r3505421610) with rationale + link; expipiplus1 resolved it (accepted). Both Copilot findings settled.
- **Bot-initiated** ready/merge is operator-gated; a **maintainer** merging his own approved PR is fine and outside our gate — expipiplus1 is clearly driving toward that. On merge, #11859 auto-closes (`Closes #11859`). Never bot-auto-close.
- Outstanding: zangold-nv requested-review, slang-reviewer peer review in flight (against `c082a3e130`; core logic unaffected by the provenance-loc tweak).
