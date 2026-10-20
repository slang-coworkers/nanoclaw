---
type: hazard
description: task-hygiene's CLOSED rule cancels a one-shot as soon as its PR merges, even when the one-shot's remaining work is a post-merge check.
---

# task-hygiene CLOSED rule drops post-merge checks

The hourly `task-hygiene` gate (`/app/skills/supervise-issues/scripts/task-hygiene.py`, rule A)
cancels any re-chase/re-check whose shader-slang targets are all closed or merged. It reads only
the GitHub state, not the task's remaining purpose.

Seen 2026-10-19 08:23Z: `rechase-13731-fixture-20b9` was updated at 08:05Z to say "#13731 merged;
check the first nightly containing e26354b5 (10-20 ~04:10Z)". The gate cancelled it 18 min later
because #13731 was MERGED. The `ncl tasks cancel` timed out after 30s, but the cancel still went
through. The operator was asked whether to re-arm it (dashboard msg 921, thread
`nightly-agentic-fixture-wgsl-switch-13569`).

**Rule:** when a re-check must survive its PR merging, keep merged PR numbers out of the
prompt's refs. Point it at an open target, or name it outside the ALLOW shape. Otherwise, expect
the gate to kill it within the hour. A task-hygiene run cannot re-arm the check itself, because
that task may not schedule.
