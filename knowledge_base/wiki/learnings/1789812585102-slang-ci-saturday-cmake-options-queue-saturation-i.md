---
title: "slang CI: Saturday 'CMake Options' queue saturation is expected weekly load, not Critical"
type: learning
topic: ci-tooling
source: learnings/1789812585102-slang-ci-saturday-cmake-options-queue-saturation-i.md
---

# slang CI: Saturday "CMake Options" queue saturation is expected weekly load, not Critical

---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-09-19T10:09:45.102Z
---

# slang CI: Saturday "CMake Options" queue saturation is expected weekly load, not Critical

**What happened:** Heartbeat wake 2026-09-19 10:00 UTC saw `jobs_queued=93` (past the >50 Critical threshold), `hosted_runner_usage` at its 60/60 cap, with the entire backlog attributable to one workflow, "CMake Options", fanning out across the OS matrix (Windows/macOS/Linux/ARM64). Flagged 🔴 Critical and recommended maintainer investigation.

**Correction (from orchestrator, same day):** This is the workflow's **intentional** schedule: `workflow_dispatch` + `schedule: cron "0 8 * * 6"` (Saturday 08:00 UTC weekly). 2026-09-19 is a Saturday; the 09:58 UTC snapshot was ~2h into the scheduled run. The runner-budget hit (up to half the org's hosted-runner cap) is a **known, accepted cost** — the workflow's `merge_group` trigger was deliberately removed specifically because "the matrix consumed half the org's hosted-runner budget, starving other workflows," keeping only the weekly Saturday run + ad-hoc dispatch. The GCP self-hosted pools sitting idle during this is also expected — "CMake Options" targets GH-hosted runners only, never the GCP pools.

**Lesson:** Before flagging a `jobs_queued`/`hosted_runner_usage` Critical reading, check (a) whether it's a Saturday and (b) whether the dominant workflow name is "CMake Options" — if both, this is expected weekly congestion, downgrade to informational/🟢, not 🔴. More generally: a single-workflow-attributable queue spike on a schedule-cron workflow should be checked against its trigger config before escalating as an infra problem — `workflow_dispatch`+`schedule` fan-out is a different failure mode than an unbounded/regression-driven queue growth.

**Bonus, not a new finding — don't re-flag:** the weekly matrix tests each CMake option at its non-default value, including the newly-added `SLANG_INSTALL_USER_SKILLS=ON`, which is currently broken on master (duplicate-error root cause traced to PR #12963 — the same cause behind this week's red Release nightlies, already owned by the operator). Expect that leg of the CMake Options weekly to go red for that reason when it lands.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1789812585102-slang-ci-saturday-cmake-options-queue-saturation-i.md`_
