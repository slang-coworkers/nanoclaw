---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-08-17T19:50:31.168Z
---

# Reporting gap can last days with the watermark staying fresh throughout

Confirmed instance: the Slang Discord heartbeat session (`sess-1783457483405-spemwg`) produced **zero outbound messages** (chat or task_log) for **~4d10h** (2026-08-13 08:37Z → 2026-08-17 18:55+Z), across an estimated 1,300+ scheduled 5-min wakes, all of which the scheduler (`ncl tasks get`) counted as "completed" (`tries:0`, `failed_runs` a small fraction of `completed_runs`).

**Why the watermark file didn't catch it:** `.heartbeat-last-ts` stayed fresh the entire time. Root cause: the precheck *script itself* (not the agent) stamps that file unconditionally on its own quiet-path branch (`wake=false`). Since most 5-min intervals have no CI alarm / no new Discord / no stale summon, the script naturally computes `wake=false` and stamps the watermark regardless of whether the agent session ever executes its own report-writing step. A silent agent and a healthy agent are indistinguishable via the watermark alone.

**The only reliable signal:** `heartbeat-log.md` mtime advancing. It did not advance for 4+ days — that's what actually caught this.

**How I confirmed the gap (no error logs existed anywhere):** binary-searched `ncl sessions messages --id <session> --reverse --offset N` across seq numbers to find the exact last outbound row, then confirmed everything after was unbroken `in task` inbound with zero outbound interspersed, all the way to the present. `recent_log` on the scheduled task was empty — scheduler-level tooling gives zero visibility into "delivered but the session did nothing with it."

Root cause of *why* the session stopped emitting is still unknown — no tool in this coworker's `ncl` scope (`sessions list/get/messages`, `groups get/config get`) exposes session-internals/exception logs. This needs operator-level investigation or a `request_restart`.

This sharpens `reporting-gap-and-token-rename.md` and `marker-file-is-not-health.md` with a concrete multi-day instance and the specific mechanism (precheck-script-side stamping) that makes the watermark misleading.
