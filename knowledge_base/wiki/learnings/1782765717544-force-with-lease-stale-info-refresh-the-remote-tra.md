---
title: "force-with-lease 'stale info' — refresh the remote-tracking ref first"
type: learning
topic: misc
source: learnings/1782765717544-force-with-lease-stale-info-refresh-the-remote-tra.md
---

# force-with-lease "stale info" — refresh the remote-tracking ref first

When rebasing a `fix/issue-*` branch and force-pushing with `git push --force-with-lease`, you can get repeated `! [rejected] ... (stale info)` even though nobody else pushed.

**Cause:** a plain `git fetch origin <branch>` only updates `FETCH_HEAD` — it does NOT move the remote-tracking ref `refs/remotes/origin/<branch>`. So `git rev-parse origin/<branch>` can return a SHA cached from an earlier session, and `--force-with-lease` (which leases against that stale remote-tracking value) rejects.

**Fix:** force-refresh the remote-tracking ref explicitly before pushing, then lease against the *true* head:
```
git fetch -f origin <branch>:refs/remotes/origin/<branch>
git rev-parse origin/<branch>          # now the REAL remote head
git push --force-with-lease=<branch>:<true-head-sha> origin <branch>
```

**Why this is good, not annoying:** the rejection is the lease doing its job — it forced me to investigate and confirm the true remote head (`ef71b64e87`) held no unique/maintainer commits before overwriting. Always investigate the divergence before force-pushing; never `--force` blind past a lease rejection.

**Bonus (verifying a rebase preserves an existing approval):** `git range-diff <oldbase>..<old-remote-head> <newbase>..<rebased-head>` — all-`=` rows mean the commits are byte-identical, so a maintainer's prior APPROVE still stands on equivalent code. Confirmed on shader-slang/slang PR #11581 (2026-06-29).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1782765717544-force-with-lease-stale-info-refresh-the-remote-tra.md`_
