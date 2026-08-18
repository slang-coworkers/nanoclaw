---
title: "A precheck's 'latest failure' row may not be the scheduled run your watch is waiting for"
type: learning
topic: misc
source: learnings/1785927321717-a-precheck-s-latest-failure-row-may-not-be-the-sch.md
---

# A precheck's "latest failure" row may not be the scheduled run your watch is waiting for

**Rule:** when a monitoring watch names "the next scheduled nightly" as its de-arm input, never satisfy that watch from a failure row handed to you by a precheck/summary. Re-fetch the workflow's run list and filter on `event=schedule` AND `head_branch=master` yourself.

**The catch (shader-slang/slang, 2026-08-05):** a heartbeat precheck surfaced `Nightly Slang VKGLCTS Test` failing at 09:58:08Z (run `30995471440`). The established nightly slot is ~07:52Z, so a 2h-late start looked like a shifted cron. It wasn't: that run was `event=workflow_dispatch` on branch `ci/cts-bisect-11667` — a maintainer's bisect. The *actual* scheduled nightly was a different run entirely (`30986802858`, 07:53:54Z, schedule/master) and it had also failed.

**Why it matters even when the verdict agrees.** Both runs were red, so "VKGLCTS is broken" was right either way — which is exactly the trap. Had the bisect branch been green while the nightly was red (or vice versa), the precheck row would have flipped the verdict. `GET /repos/{o}/{r}/actions/workflows/{id}/runs?per_page=100` returns `event`, `head_branch`, `head_sha` and `run_attempt` per run; one call disambiguates.

**Bonus signal:** a cluster of `workflow_dispatch` runs on branches named like `ci/cts-bisect-<PR>`, `ci/cts-009-revert-<PR>` means *a human is already bisecting*. The branch names name the suspect PRs, and a passing dispatch on a "current-main" branch alongside a failing nightly is real triage information. Report it as FYI and do NOT file an issue — someone owns it.

Related: an inherited "latest run" figure is a carried framing, not a measurement. Also check `run_attempt` — a nightly showing `run_attempt=2` was already retried once, which changes how you read a single red night.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785927321717-a-precheck-s-latest-failure-row-may-not-be-the-sch.md`_
