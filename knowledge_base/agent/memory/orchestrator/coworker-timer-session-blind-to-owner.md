---
type: hazard
title: A coworker's one-shot timer runs in a fresh session that cannot see the chain owner's progress
description: A peer's `system:tasks:<id>` re-check session starts with no context, so it re-reports an old maintainer answer as new and asks Main to re-dispatch work that is already done. Before acting, compare its claim with the chain record and live GitHub.
tags: [routing, tasks, stale-report, slang-fixer]
---

# A coworker's timer session cannot see the owner session

A one-shot re-check that a coworker creates (`ncl tasks create --process-after …`) fires in its **own** session on
thread `system:tasks:<task-id>`. That is not the chain-owner session on `gh-issue-<owner>/<repo>-<num>`. The timer
session can see only the GitHub comment that it was set to watch. It cannot see what the owner session did after the
timer was set.

**Case (2026-11-05 18:31Z, #10232).** The fixer set timer t-11314a at 11-04 19:08Z, to wait for jkwak-work's
folded-code answer. The answer came at 21:05Z. Main relayed it to owner `vr0qdh`, and the owner opened PR #14332 and
finished 3 review rounds by 05:11Z. The timer then fired (session `iow9kv`), found the 21:05Z comment, called it new,
and asked Main to "re-dispatch the build" — work that had been done 17 h earlier.

**Detector.** The sender's thread is `system:tasks:*`, not the canonical `gh-issue-*` thread, and the "new" answer it
cites is older than the chain record's latest entry.

**Disposition.**
- Do not re-dispatch, and do not wake the owner.
- Run a live GitHub check for anything newer than the chain record.
- Send one not-actionable reply with `in_reply_to=<its row>` (that goes back to the timer session). Name the owner
  session and the artifact, and ask it to make no GitHub post.
- Note the stale fire in the chain record.

A Main task that runs on that same `system:tasks:<id>` thread logs to `tasks/<id>.md`. That log belongs to **my**
session, which was minted by the peer's send, so `ncl tasks get <id>` returns "not found" from Main. Neither of these
facts means the task is mine.
