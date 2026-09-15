---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1784469947466-905tds
written_at: 2026-09-15T01:44:26.000Z
---

# GitHub baseRefOid is the base-branch tip, not the PR fork point — and the MatrixLayoutMode base-skew signature

# baseRefOid ≠ fork point; the MatrixLayoutMode base-skew signature

**Date:** 2026-09-15. **Context:** slang PR #13078 SlangPy-Tests failure, misdiagnosed by me as a compiler regression, corrected by slang-fixer + codex, then independently re-verified.

## The gotcha that produced a wrong "regression" lead

GitHub's `baseRefOid` (from `gh pr view --json baseRefOid`, and the GraphQL field) is **the current tip of the base branch**, NOT the PR's merge-base / fork point. As master advances, `baseRefOid` moves with it. So "the PR's base is ahead_by:N of commit X" tells you **nothing** about whether the PR's own tree contains X — it only says master currently contains X.

I read `baseRefOid` as "ahead of #12986 (the commit that added `enum MatrixLayoutMode`)" and concluded "#13078 has the enum in its tree," which then forced a bogus mechanism (IR-op/stable-name serialization corruption) to explain why a built compiler still couldn't resolve the enum downstream. Both were wrong.

**To test whether a PR's tree actually contains a symbol or a commit, check the HEAD tree or the fork point — never `baseRefOid`:**
- `git grep -n "<symbol>" <head-sha> -- <path>` (blobless clone + `git fetch origin pull/<n>/head` is enough; slang is public, no token needed).
- `git merge-base <head-sha> origin/master` = the true fork point.
- `git merge-base --is-ancestor <commit> <head-sha>; echo $?` → 0 = commit is in the PR's history, non-zero = it is not.

## The compiler-architecture leg (decisive on its own)

An **`undefined identifier`** (E30015) is a **front-end name-lookup diagnostic**, emitted during parse/semantic-check of the source, entirely **before any IR (de)serialization**. IR-op / stable-name serialization corruption therefore *cannot* produce an unresolved source identifier — it would abort module load or miscompile, not surface "undefined identifier." So any lead that blames an IR-op addition (e.g. a new `…Decoration`, correctly stable-named) for an `undefined identifier` is falsified by architecture alone, no git check required. AST and IR chunks deserialize separately.

## Fast-classify heuristic (for CI sweeps)

SlangPy-Tests failing with `undefined identifier 'MatrixLayoutMode'` → E30624 (generic value param type 'error') → E30855, at slangpy `print.slang:260` (`let L : MatrixLayoutMode`): this is the **base-skew signature**, not a live regression. `MatrixLayoutMode` was added to `core.meta.slang` by **#12986 = `578d571f9e`**. Check the PR's fork point vs that commit; if the PR forked *before* it, the PR's Slang can't resolve the enum that slangpy-main now uses → **relabel needs-rebase, do not route to the fixer as a regression.** Rebasing past #12986 greens it. This is the same MatrixLayoutMode stale-base pattern seen on #12674/#12848 and now #13078; siblings on a fresh base (e.g. #13071) pass.

## Meta-lesson

Verify the crux at the source **before propagating a correction** in *either* direction — the same discipline the Falcor 403 flip-flop taught. Here it caught my own falsified anchor before I over-committed the babysitter's tracker. The blast radius stayed internal (no operator was ever told the wrong lead), but the fix is the same: receipts first.
