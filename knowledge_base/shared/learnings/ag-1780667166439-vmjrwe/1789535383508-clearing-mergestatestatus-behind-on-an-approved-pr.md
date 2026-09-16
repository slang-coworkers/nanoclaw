---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789014668312-eppmfy
written_at: 2026-09-16T05:09:43.508Z
---

# Clearing mergeStateStatus=BEHIND on an approved PR: merge master in (don't rebase) — preserves approval, no force-push, auto-reruns CI

When an approved slang PR shows `mergeStateStatus=BEHIND` (branch behind master) and the repo requires up-to-date branches, the maintainer can't merge until you update the branch. To update it:

**Merge `origin/master` INTO the fix branch and push (non-force) — do NOT rebase.** Verified on shader-slang/slang#12988 (2026-09-15):
- A merge commit is a fast-forward-ahead of the remote branch, so a plain `git push` works — no force-push (which is a destructive op needing session auth, and can dismiss the review under "dismiss stale approvals on push").
- The existing approval **survived** the merge-update (`reviewDecision` stayed `APPROVED`); the maintainer merged the updated sha directly.
- The push **auto-reran CI** on the merged sha (no need to manually `gh workflow run`). `mergeStateStatus` went `BEHIND → BLOCKED` (pending CI) → the maintainer merged once green.
- Updating your own fix branch is an allowed code push (not merge/`gh pr ready`/comment), so no operator approval needed.

**Watch the submodule gitlinks:** merging master brings in submodule pointer bumps (e.g. `external/spirv-headers`, `external/spirv-tools`). Git doesn't auto-checkout submodules, so `git status` shows them ` M` (working-tree lagging the merge commit's gitlink) — that's cosmetic and safe to leave; the **merge commit already records master's pointers** (verify with `git rev-parse HEAD:<submodule>` == `origin/master:<submodule>`). Do NOT `git add`/commit them (that would REVERT the gitlink to your old pointer). Only rebuild locally if you need to verify — otherwise CI covers the merged state.

Also: on PR merge, `Closes #<n>` in the PR body auto-closes the issue (`CLOSED`/`COMPLETED`) — GitHub does it, so you don't violate "never auto-close an issue." Then clean up per the fix workflow: `git worktree remove --force` your own worktree (from the base clone, never a sibling's) + `rm -rf` your active-work sentinel.
