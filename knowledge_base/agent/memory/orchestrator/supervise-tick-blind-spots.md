---
type: runbook
description: Real stalls that /supervise-issues scan.py misreads as awaiting_human / running / cost_stopped — each with the detector that catches it and how to nudge. Split from the tick runbook 2026-10-13.
---

# /supervise-issues scan blind spots (real stalls scan misses)

scan.py classifies by who spoke last on GitHub and by session status. These shapes defeat both; check for them every
tick after the scan. Procedure: [[orchestrator/supervise-tick-runbook.md]]. The inverse list (flags that aren't real):
[[orchestrator/supervise-tick-false-positives.md]].

**General detector:** `tickNNN/blind.py` — sort rows by **timestamp** (`--reverse` order is by seq and unreliable), read
20, flag sessions whose newest row is an unanswered `in` with the container not running. Always nudge with
`target_session_id` pinned and confirm the `in` landed.

1. **Round-2 review request stalls in the reviewer, not the fixer** (tick 264). A `[Fix Review Request]` lands in a
   slang-reviewer session whose container stops without processing it; scan flags `awaiting_us` against the *fixer*.
   Nudge **slang-reviewer** pinned.
2. **Bot said "On it", then the owning container stopped** (tick 267, #12875: 9 h stall, fixer lost context). Bot spoke
   last → `awaiting_human`. Detector: owning session's newest row is an `in` webhook with no `out` after, PR head unmoved.
3. **Owning session is on a sub-thread** (tick 275). #13406 work ran on `gh-issue-shader-slang/slang-11709/13406-resume`,
   in neither chain's session set; jhelferty's split-PR ask sat 9 h while scan read `cost_stopped`/`awaiting_human`.
   Detector: for chains whose newest human comment is an instruction the bot acked, find the PR's `pr-mappings` row and
   grep `ncl sessions list` for `thread_id`s with `/` after the issue number.
4. **Reviewer acked with an ETA, then died silently** (tick 277, #13518: "verdict in ~45 min", sub-runs failed —
   A out of its $30 inner budget, C ECONNREFUSED — 11 h idle). Newest row is an `out`, so blind.py misses it. Detector:
   a stopped reviewer whose newest `out` promises an ETA older than ~2× that ETA; corroborate with
   `A-/B-/C-<pr>-r<N>.done` (`.done` = rc) in `/workspace/extra/ephemeral/prod-groups/slang-reviewer/`.
5. **Fixer never processed the reviewer's verdict** (tick 278, #13571: inbound `[Review Verdict]` REQUEST_CHANGES at
   00:06Z, container stopped, head unmoved 12 h). blind.py catches it; check the PR head before nudging.
6. **Inbound lost to compaction while the container stays `running`** (tick 279, #13579). scan treats `running` as live.
   The triager's newest row was the 22:33Z relay, but its last model request was 22:02Z. Read `request.timestamp`
   across the last ~25 lines of `.claude-trace/session-<sid>.jsonl` — not the file mtime or the last `logged_at`, which
   was a long-lived SSE stream flushed later (00:11Z). Nudged pinned; it acked "lost the relay when my context was
   compacted".

Shape 1 recurred at tick 280 (#11803 R2 request, reviewer `bokz3c` stopped 6.7 h); blind.py caught it and the
pinned nudge acked in under a minute.

Typical outcome: every pinned nudge above acked within 1–3 min.
