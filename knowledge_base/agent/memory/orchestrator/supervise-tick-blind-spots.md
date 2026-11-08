---
type: runbook
description: Hub for real stalls that /supervise-issues scan.py misreads as awaiting_human / running / cost_stopped — the general detector plus a numbered shape list; detail lives in three subtopic files. Split from the tick runbook 2026-10-13; split again by subtopic 2026-11-07.
---

# /supervise-issues scan blind spots (real stalls scan misses)

scan.py classifies by who spoke last on GitHub and by session status. These shapes defeat both; check for them every
tick after the scan. Procedure: [[orchestrator/supervise-tick-runbook.md]]. The inverse list (flags that aren't real):
[[orchestrator/supervise-tick-false-positives.md]].

**General detector:** `tickNNN/blind.py` — sort rows by **timestamp** (`--reverse` order is by seq and unreliable), read
20, flag sessions whose newest row is an unanswered `in` with the container not running. Always nudge with
`target_session_id` pinned and confirm the `in` landed; pinned nudges typically ack in 1–3 min. Its top hits are mostly
"Learning saved" system acks (5 of 6 at tick 289) — skip those.

Shape numbers are stable (the tick runbook, chain records and helper names cite them). New shapes take the next number
and go in the matching subtopic file, not here.

## Owner session stopped or deaf — [[orchestrator/supervise-tick-blind-spots-session-stalls.md]]

1. Round-2 review request stalls in the reviewer, not the fixer.
2. Bot said "On it", then the owning container stopped.
3. Owning session is on a sub-thread / takeover-PR thread / closed `system:tasks:` session (pr-mappings).
4. Reviewer acked with an ETA, then died silently.
5. Fixer never processed the reviewer's verdict.
6. Inbound lost to compaction while the container stays `running`.
12. Fixer waits on a CI-rerun webhook that never comes.
17. The operator's cost Continue is recorded but never takes.
19. A relay or webhook that never lands (`relaycheck.py`, `deliv.py`).

## Turn killed mid-flight — [[orchestrator/supervise-tick-blind-spots-dead-turns.md]]

10. Fleet restart killed a turn mid-tool-call (`stop_reason: tool_use`).
11. Gateway key budget 422 (`budget.py`).
13. Context overflow 400s; session went running → stopped (`runstop.py`).
14. Gateway 429 wave (`rl429.py`).
18. Gateway 5xx wave (`rl5xx.py`); also how to resume a dead Main chain session.

## GitHub state scan can't see — [[orchestrator/supervise-tick-blind-spots-github-state.md]]

7. Approved + auto-merge armed, but the PR is `DIRTY`.
8. Approved bot PR evicted from the merge queue.
9. Open bot draft whose target issue closed under it.
15. A merged PR fires a resume trigger that lives only in chain memory.
16. The reporter's own fix PR lands after dispatch.
