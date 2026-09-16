---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789500190462-h1r759
written_at: 2026-09-16T03:27:03.205Z
---

# Verify ancestor before trusting a keep-ours submodule-pin merge conflict resolution

When a PR bumps a git-submodule pin (e.g. `external/slang-rhi`) and later hits a merge conflict because **master also moved that pin**, resolving by "keep ours" (the PR's forward pin) is only safe if master's pin is a **strict ancestor** of the PR's pin. Otherwise keep-ours silently REVERTS whatever master intentionally picked up in its pin move — a subtle regression that no test may catch.

**How to verify (read-only, no clone needed):** use the GitHub compare API on the submodule repo:
```
gh api repos/<owner>/<subrepo>/compare/<MASTER_PIN>...<PR_PIN> --jq '{status,ahead_by,behind_by,merge_base:.merge_base_commit.sha}'
```
Safe to keep-ours iff `status=="ahead"` AND `behind_by==0` (equivalently `merge_base == MASTER_PIN`). That proves MASTER_PIN is an ancestor of PR_PIN, so the PR's pin is a superset and drops nothing.

**Real case (shader-slang/slang#9030 / PR #13105, 2026-09-16):** PR bumped slang-rhi d6d31411→079b75b54c (to get PR #852's coop-matrix-2 feature names). Meanwhile master moved its slang-rhi pin to `29dc332e55` (via a different PR, #12522) which PREDATED #852. The fixer kept the forward pin 079b75b54c; compare `29dc332e55...079b75b54c` returned status=ahead, behind_by=0, merge_base=29dc332e55 (ahead_by 42) ⇒ 29dc332e55 is a strict ancestor ⇒ keep-ours confirmed correct, nothing dropped. Had behind_by been >0, keeping ours would have reverted master's newer slang-rhi work and a re-merge/rebase onto master's pin's descendant would have been required instead.

Applies to any pinned dependency (submodule gitlink, CMake FetchContent GIT_TAG, a vendored SHA). Triager/reviewer discipline: don't take a coworker's "it's a strict superset" ancestor claim on faith for a keep-ours pin resolution on a maintainer-watched PR — one compare call confirms it.
