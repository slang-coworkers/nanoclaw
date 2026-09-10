---
name: feedback_squash_merge_breaks_merge_base_ancestor_check
description: git merge-base --is-ancestor returns NON-ZERO after a squash merge even though the fix landed — the branch tip never becomes an ancestor of main. Correct arbiter is merged file content + parent count (1 = squash).
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 02d0dfc6-a82a-441a-af2d-499cb10a0f13
---

**`git merge-base --is-ancestor <branch-tip> main` returns non-zero on a squash-merged PR even though the fix fully landed.** A squash merge creates a *new single-parent commit* on `main` containing the combined diff; the original branch tip is never made an ancestor. The check is therefore structurally incapable of confirming a squash merge — and it fails *silently and confidently*, producing a "not merged" report that reads as authoritative.

**Why this is dangerous, not merely wrong:** the failure is asymmetric. A false "not merged" invites remediation on something already done — re-pushing, re-opening, or performing a human-gated close/merge on an already-merged PR. The check's exit code carries no hint that squash was the merge strategy, so nothing prompts a re-derivation. This is the same class as [[feedback_verify_pushed_state_by_branch_not_sha]]: a git primitive answering a *different* question than the one being asked.

**Correct arbiter — verify the landed content, not the graph:**
- `gh api repos/{o}/{r}/pulls/{N}` → `merged: true`, `merge_commit_sha`, `merged_at`, `merged_by`.
- Read the **merge commit**: `parents` length **1 ⇒ squash** (2 ⇒ true merge commit). Then confirm `files` and the actual patch hunks match what was intended.
- Best of all: read the **file content on `main`** and confirm the expected text is present. That answers "did the fix land" directly, with no graph reasoning.

**Related mechanism, same chain (TRUE, but see the correction):** a `Closes #N` auto-close lands ~1 second *after* `merged_at` — closure is **eventually consistent** with the merge, a follow-up action rather than part of the merge transaction. A read at `merged_at+0s` can *legitimately* observe OPEN. Before acting on any "the auto-close did not fire" claim, **re-read issue state**; otherwise you perform a human-gated close on an already-closed issue.

⚠️ **But that race did NOT cause the #805 incident — I recorded a guessed cause as fact.** The fixer (the only tier that could see its own timing) refuted it: its issue-state command was **denied by its critique gate and never ran**, its fallback was **git-only** (⇒ **capability-mismatched** — git cannot see GitHub issue state), and it asserted "still OPEN" from a **~8h-old** remembered value. Its read was **~2 min after `closed_at`**.
- ⭐⭐ **PRIMARY: a blocked verification call means UNKNOWN, not UNCHANGED.** No care *within* a capability-mismatched fallback could have helped.
- ⭐⭐ **Don't attribute a cause living in another agent's container.** Triager had 2 timestamps 1s apart, found a mechanism that *fit*, and promoted "fits my data" → "almost certainly what happened". It was **exculpatory** ⇒ drew no challenge. I then published it. **A charitable explanation needs MORE evidence than an accusatory one.**
- ⭐ **A learning inherits the unverified premises of the report it was filed from** ⇒ **file at the granularity of what was VERIFIED.** A true mechanism and a guessed cause in one file read as equally confident.

Observed 2026-08-03 on shader-slang/slang-rhi#805 / PR #806 (squash-merged `57b5dec033`, 1 parent, author `nv-slang-bot[bot]`). The fixer hit the ancestor trap; the close-window story was a misdiagnosis corrected twice. See [[project_slang_rhi_805_license_readme_mismatch]], [[feedback_github_writes_operator_authorized]] (closes are human-gated), [[feedback_always_reap_merged_worktrees]] (reaping decisions depend on getting "is it merged?" right).
