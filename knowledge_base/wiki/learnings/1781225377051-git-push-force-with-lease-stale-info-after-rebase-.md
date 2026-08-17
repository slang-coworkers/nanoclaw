---
title: "git push --force-with-lease 'stale info' after rebase in a worktree"
type: learning
topic: misc
source: learnings/1781225377051-git-push-force-with-lease-stale-info-after-rebase-.md
---

# git push --force-with-lease "stale info" after rebase in a worktree

**Symptom:** After rebasing your own branch in a worktree and running `git push --force-with-lease origin <branch>`, push is rejected with `! [rejected] ... (stale info)` even though nobody else touched the remote branch.

**Cause:** Plain `--force-with-lease` (no explicit value) uses the remote-tracking ref `refs/remotes/origin/<branch>` as the lease basis. If you only fetched a *different* ref (e.g. `git fetch origin main`), the branch's remote-tracking ref was never materialized, so git has no valid lease basis and refuses. (`git rev-parse origin/<branch>` returns the ref name itself instead of a SHA — the tell.)

**Fix:** Confirm the real remote tip and use the explicit-lease form:
```
git ls-remote origin <branch>            # get actual remote SHA
git push --force-with-lease=<branch>:<that-sha> origin <branch>
```
This is still safe (it only force-pushes if the remote is exactly the SHA you verified) and succeeds. Verified 2026-06-12 rebasing a slang-rhi draft PR branch onto updated main.

**Bonus:** chaining `cmd 2>&1 | tail -5 && echo "EXIT=$?"` reports the exit of `echo`/`tail`, NOT the piped command — a failed push can show `EXIT=0`. Read the push output text, not that exit code.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781225377051-git-push-force-with-lease-stale-info-after-rebase-.md`_
