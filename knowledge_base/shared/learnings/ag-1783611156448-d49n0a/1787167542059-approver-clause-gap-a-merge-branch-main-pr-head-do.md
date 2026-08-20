---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1787166837580-o0j7nw
written_at: 2026-08-19T19:25:42.059Z
---

# [approver/clause-gap] A "Merge branch main" PR head does not poison path/size clauses — the clause uses base...head (merge-base), so read the PR's own contribution, not last-reviewed-commit...head

**Symptom:** slangpy#1080 head `c61d279` was a "Merge branch 'main'" commit landed via a `synchronize`. A raw compare of the last *human-reviewed* commit vs. head (`3d50ffc...c61d279`) pulls in **all of main's** intervening changes — `.github/**`, `CMakeLists.txt`, `external/bc7enc/*`, `*.yml`, thousands of lines — every one a protected path and far over the size cap. Reading that diff naively would wrongly conclude `CLAUSE_FAIL:no_protected_paths` / `tier_eligible`.

**Root cause / how it actually evaluates:** `eval-clauses.py` computes changed paths as `compare/{base_ref}...{sha}` — a **three-dot (merge-base) diff**, i.e. the PR's contribution relative to where it forked from `main`, NOT head-minus-main-tip and NOT last-reviewed-commit-minus-head. So a merge-from-main commit that only pulls `main` forward (`behind_by 0`, `ahead_by N`) contributes **zero net new paths** beyond the PR's own files. For #1080 the clause correctly saw exactly the 2 PR files (`tensor.cpp` +7/-0, `test_array.py` +123/-11, 141 lines) and passed both path/size clauses. `gh pr diff` agrees because it also diffs against the merge-base.

**How to catch it / how to apply:** When a PR head is a merge commit and you're eyeballing the diff for the challenger or sanity-checking a clause, use `compare/{base}...{head}` (three-dot) or `gh pr diff` — never `{last-reviewed-sha}...{head}`, which conflates the PR's edits with whatever landed on the base branch in between. Confirm with `.status`/`.behind_by`/`.ahead_by` from the compare API: `behind_by 0` means the merge only fast-forwarded the base in and added nothing to review. The clause script already does the right thing; the trap is a human/challenger second-guessing it off the wrong compare and manufacturing a false CLAUSE_FAIL. (Decision itself was `ABSTAIN_POLICY:CLAUSE_FAIL:author_trust` — bot-authored `CONTRIBUTOR` — unrelated to this; this note is about not letting a merge head fabricate a *different* false clause fail.)
