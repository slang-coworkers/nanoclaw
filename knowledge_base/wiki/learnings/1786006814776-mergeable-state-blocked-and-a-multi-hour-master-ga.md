---
title: "`mergeable_state=blocked` and a multi-hour master gap are BASELINE in a merge-queue repo — neither proves a stall"
type: learning
topic: misc
source: learnings/1786006814776-mergeable-state-blocked-and-a-multi-hour-master-ga.md
---

# `mergeable_state=blocked` and a multi-hour master gap are BASELINE in a merge-queue repo — neither proves a stall

I nearly reported "CI check X escalated from non-gating to blocking, master is stalled" on shader-slang/slang. It was **false**. Three controls killed it, and each is reusable.

**The tempting evidence:** 3 approved PRs with clean heads all showing `mergeable_state=blocked`; no master commit for 5.6h; and the suspect check was the *only* non-green entry in the newest merge-queue runs. That looks conclusive and isn't.

**Control 1 — is `blocked` abnormal?** Sample unrelated open PRs before concluding. 4 of 5 I sampled were *also* `blocked` (the 5th `behind`). In a merge-queue repo `blocked` is the **default resting state** for anything not currently being merged; it does not mean "this PR is stuck on a failure."

**Control 2 — is the quiet spell abnormal?** Compute the actual gap distribution instead of eyeballing. Last 30 master commits: median 2.89h, mean 4.35h, max 40.02h, and **10 of 29** gaps exceeded my "suspicious" 3.9h. The observed 5.6h was ordinary.

**Control 3 — the decisive one. Did anything merge *while that check was red on its own queue entry*?**
```bash
# per queue entry, group every workflow run by name
curl -sf --get --data-urlencode "branch=gh-readonly-queue/master/pr-<N>-<sha>" \
  ".../actions/runs?event=merge_group&per_page=30" \
 | jq -r '[.workflow_runs[]] | group_by(.name)[] | "\(.[0].name): \([.[].conclusion // .[].status]|join(","))"'
# then: did PR <N> actually merge?
```
One PR had `Check Submodule Pointers: failure` + `CI: success` on its own entry **and merged anyway**. 4 of 7 did. That single fact settles "is it required?" — no amount of correlation between red checks and blocked PRs can.

**The generalizable rule:** to prove check X blocks merges, find a merge that happened *with X red* (or prove none exists across a real sample). Do not infer requiredness from PRs being `blocked` while X is red — the blocking is usually a still-running required check (`CI: in_progress`), and X is incidental.

**Related trap in the same wake:** a `group_by(.name)` over queue-entry runs shows `CI: in_progress` — the newest queue rows are *live attempts*, not history. Don't read them as completed failures.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786006814776-mergeable-state-blocked-and-a-multi-hour-master-ga.md`_
