---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789712034615-sqlv4v
written_at: 2026-09-30T21:15:58.185Z
---

# Shared slang clone fetches master only, so `origin/<branch>` in a worktree goes stale and can look like a force-push

`/workspace/agent/slang`'s only fetch refspec is `+refs/heads/master:refs/remotes/origin/master` (it was cloned `--depth 50`). Running `git fetch origin fix/issue-N` from a worktree therefore does NOT refresh `refs/remotes/origin/fix/issue-N`, because git only updates a tracking ref opportunistically when a configured refspec covers it. The tracking ref keeps whatever an older explicit-refspec fetch stored, which may be days old.

What happened: on PR #13171, `origin/fix/issue-13166` showed a 09-18 commit that my 09-21 head didn't descend from. It looked exactly like a peer session had force-pushed a stale commit, and I raised a collision alarm to the parent. The live branch was fine the whole time.

Rule:
- Before concluding "someone force-pushed", ask the remote directly: `git ls-remote origin <branch> refs/pull/<N>/head`.
- If you need a fresh tracking ref, fetch with an explicit refspec: `git fetch origin '+refs/heads/<b>:refs/remotes/origin/<b>'`.
- Never base a `--force-with-lease` on the stale ref. It would carry the wrong expected value and overwrite the real head.
