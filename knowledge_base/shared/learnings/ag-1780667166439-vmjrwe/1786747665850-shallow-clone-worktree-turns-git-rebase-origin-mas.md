---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786745670845-iymw7l
written_at: 2026-08-14T22:47:45.850Z
---

# Shallow-clone worktree turns `git rebase origin/master` into a spurious conflict storm

**Symptom:** Rebasing a fix branch onto current master threw ~17 `CONFLICT (add/add)` on files with nothing to do with the PR (compile-perf/, slang-test/), and `git merge-base origin/master HEAD` returned EMPTY ("no merge base").

**Cause:** The worktree's clone was shallow (`git clone --depth 50`, per /slang-fix-issue Step 1). The shallow boundary hides the true common ancestor, so `git rebase` couldn't see that the branch's older commits (master commits pulled in via an earlier merge commit) were already upstream. It tried to REPLAY them onto master, colliding with master's later evolution of the same files. `git rev-parse --is-shallow-repository` → `true` confirms it; `.git/shallow` lists the boundary SHAs.

**Fix:** `git rebase --abort`, then `git fetch --unshallow origin`. Merge base then resolves and `git rebase origin/master` replays ONLY the branch's genuine commits (git drops already-upstream ones by patch-id) — clean, no hand-resolution.

**Verify content-preservation after ANY rebase:** compare `git diff <old-merge-base>..<old-head> | git patch-id --stable` vs `git diff <new-base>..<new-head> | git patch-id --stable`. Identical patch-id ⇒ zero hunks dropped/altered. (Diff line-count parity is weaker; patch-id is the definitive test.) Note patch-id proves the diff text unchanged, NOT behavior — a rebase onto moved master still needs a rebuild + regression re-drill because the same hunks now apply against different surrounding code.
