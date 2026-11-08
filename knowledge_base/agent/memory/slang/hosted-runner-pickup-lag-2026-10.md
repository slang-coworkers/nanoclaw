---
type: incident
title: Recurring GitHub-hosted ubuntu-latest pickup lag on shader-slang/slang (Oct 2026)
description: "Four or more episodes 10-27→10-30. Hosted jobs sit queued 45–150 min while in-progress is 1–5 of 60 and githubstatus is clean. The queue is mostly `PR Checks Complete Sync` (workflow_run) plus per-push light workflows. It stalls the merge queue. Cause unverified; it needs an org Actions admin."
tags: [ci, github-actions, hosted-runners, merge-queue]
---

# Hosted ubuntu-latest pickup lag (Oct 2026)

| episode | peak | mostly | our bot's share | cleared |
|---|---|---|---|---|
| 10-27 16:0x–18:3x | 65 runs, 2h25m oldest | 44× `PR Checks Complete Sync` from albertrodriguezclo fork PRs | ~7 light runs | drained by itself around 20:00 |
| 10-27 19:00–20:15 | 144 runs | 92 jkwak-work branch updates (×6–7 light workflows each) | none | drained |
| 10-28 14:29–15:00 | 46 runs | `PR Checks Complete Sync` burst | — | drained around 15:30 |
| 10-30 15:33–16:38+ | 55 jobs / 42 runs | `PR Checks Complete Sync` ×18–20, `Check IR Version`, merge-group checks | — | slow drain; merge queue stalled about 20 h (with slangpy#1250) |

**Constants:** hosted in-progress stays at 1–5 out of 60, so the org's 60 cap isn't the limit. githubstatus shows no Actions incident.
GCP pools are fine. The fan-out is `PR Checks Complete Sync` (a `workflow_run` trigger) plus the per-push light workflows: PR
Maintenance, REUSE, Verify PR Labels, Check Formatting, Claude PR Review and SlangPy Trigger.

**What I've told the operator:** 10-27 17:01Z, 18:28Z and 20:15Z (offered to cancel stale sync runs, which became moot), plus the 10-30 16:04Z
merge-queue stall post. The ask is the same each time: an org Actions admin should check hosted concurrency and billing, and whether
`PR Checks Complete Sync` should fire on every PR event.

**Rule:** the bot isn't the cause. Before blaming anyone, check the queued runs by actor and workflow
(`gh api repos/shader-slang/slang/actions/runs?status=queued`). Don't re-alert for each episode; only report a change in shape, or
our own bot causing it (as with the 10-22 CMake Options dispatch).
- **10-30 17:50:54Z:** GitHub opened an incident, "Incident with Actions, Pages, and Webhooks" (Actions degraded), which corroborates a GitHub-side cause for at least this episode. The 16:20–17:00Z stall predates the incident post.
- **10-30 18:25Z:** the hosted lag drained (2 queued runs). #13855's merge group moved again at 18:20Z. The GitHub incident was still open. A separate blocker remained: #13848 at the head of the queue, waiting on the self-hosted Windows benchmark runner (reported by another session at 18:13Z).
- **10-30 20:0xZ:** the merge queue is moving again: 5 PRs merged since 14:11Z (#14052, #13848, #13918, #13855, #14068), master at `d34a5eb5`. `test-benchmark` is NOT a required check, so #13848 merged while its benchmark job was still queued. That corrects the 18:13Z report.
- **11-04 17:40Z:** GitHub opened "Incident with Actions" (major, partial_outage). The hosted ubuntu-latest lag came back (61 jobs queued; Linux GH 30 queued / 0 running). External cause, nothing for us to do; the dashboard was not re-alerted.
- **11-07 08:00Z: the weekly scheduled CMake Options run 42353637429 (490 jobs) used the entire hosted cap.** At 10:1xZ it had 60 jobs in_progress, 150 queued and 280 completed. This is the same Saturday pattern as 10-17 and 10-24; a sibling session reported it correctly at 10:04Z. **I got it wrong at 09:27Z (511761):** I called it a "total stop at low load, probably GitHub-side, have an org admin check" because the RUN-level `status` was `queued` and `runs?status=in_progress` showed no hosted run. I corrected this in 511767 and told discord-support (511769).
- **11-07 10:51Z: recovered** (per discord-support, 511772). `update-health` ran, so analytics frames resumed. CMake Options was at 419/490 done, with the remaining queue on macOS GH only. The dashboard was not re-alerted.
- ⛔ **Lesson: a run's `status` can stay `queued` while 60 of its jobs run.** Before calling a hosted stall "low load", count JOBS: `gh api "repos/shader-slang/slang/actions/runs/<id>/jobs?per_page=100&page=N"` page by page (`--paginate` hits the false `app_not_connected`), for every queued run, starting with CMake Options on Saturdays from 08:00Z.
