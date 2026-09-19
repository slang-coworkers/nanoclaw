---
title: "CI babysitter: rerun-log.jsonl entries can be wrong; rerun-tracker.json has drifted into narrative bloat against spec"
type: learning
topic: ci-tooling
source: learnings/1789790659798-ci-babysitter-rerun-log-jsonl-entries-can-be-wrong.md
---

# CI babysitter: rerun-log.jsonl entries can be wrong; rerun-tracker.json has drifted into narrative bloat against spec

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-09-19T04:04:19.798Z
---

# CI babysitter: rerun-log.jsonl entries can be wrong; rerun-tracker.json has drifted into narrative bloat against spec

**Found 2026-09-19 sweep (~04:00Z), shader-slang/slang CI babysitter role.**

1. **Don't trust rerun-log.jsonl entries at face value — cross-check against live `gh pr checks` + the tracker's own prior notes.** The 2026-09-19T02:04:12Z sweep logged `{"pr":12563,"action":"note","verdict":"resolved","reason":"unchanged, all-green, run ~35297027068"}` — but the SAME sweep's rerun-tracker.json note for 12563 (20:05Z/22:05Z 09-18) said `falcor-build-approval-gate` (job 105451632742) was still pending, and a fresh `gh pr checks 12563` two hours later confirmed the identical job ID was still pending. The log line was simply wrong (likely a copy/paste or batch-processing slip when writing ~20 near-identical lines in one sweep). Cost of catching it: one extra live check. Cost of not catching it: a future sweep trusting "resolved" and silently dropping tracking on an actually-still-wedged PR. Corrected with a `"action":"correction"` line rather than editing the bad line in place (append-only file).

2. **rerun-tracker.json has ballooned to 300+KB** from `"notes"` arrays that log a full narrative reconfirmation (timestamp + multi-sentence reason + verdict) for essentially every PR on essentially every sweep, going back weeks — even for PRs that are simply all-green with no action taken. This directly contradicts the CLAUDE.md instruction: *"Do not write per-sweep narration into this file... Keep the tracker machine-readable"* — the schema only specifies `reruns`/`requeues` counters+events. Practical effect: reading the file (even filtered to ~20 PRs via `jq`/Python) produces 40KB+ outputs per sweep, which is wasted token spend that compounds daily. Recommendation for future sweeps: stop adding `"notes"` entries to rerun-tracker.json; if a reconfirmation is worth recording at all, it belongs in rerun-log.jsonl (already the designated append-only narrative log) — and even there, don't re-log an *unchanged* legitimate/gate-wedged verdict every single sweep if the run/job IDs are byte-identical to the last log entry; only log on a state change or roughly once/day for continuity.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1789790659798-ci-babysitter-rerun-log-jsonl-entries-can-be-wrong.md`_
