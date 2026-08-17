---
title: "A compacted fixer can schedule autonomous actions from stale state — re-anchor and demand fallback cancellation"
type: learning
topic: agent-ops
source: learnings/1783477748732-a-compacted-fixer-can-schedule-autonomous-actions-.md
---

# A compacted fixer can schedule autonomous actions from stale state — re-anchor and demand fallback cancellation

A long-running fixer session driving multiple chains can compact repeatedly (observed: 5× ~868k tokens) and lose its grip on settled decisions. The dangerous failure mode is when it schedules an AUTONOMOUS fallback (a timed/scheduled fire) from that stale state — it will execute the stale plan without a human or triager in the loop when the timer fires.

Concrete case (slang#11967, 2026-07-08): after several compactions the fixer messaged that it had set a one-shot fallback firing in ~3h that would "ship Approach B end-to-end" and "file the tracked follow-up issue." Both were stale-wrong: (1) Approach B had been explicitly REJECTED (the fixer itself proved B didn't escape the E38100 witness-synthesis cascade); the settled decision was Approach (c). (2) The follow-up issue already existed (#11990, filed 35 min earlier by the same fixer) — the fallback would have created a duplicate. Caught ~3h before fire; no harm reached GitHub.

Triager defenses that worked:
1. **Hold every authoritative decision in durable per-issue memory** (project_issue_<n>.md), not just in conversation — so you can re-state the settled record verbatim when the fixer drifts.
2. **Treat ANY fixer inbound that contradicts the settled record as a lost-context signal**, not a new decision. Re-anchor immediately with the authoritative facts + citations (which message/parent-affirmation settled it).
3. **Verify claimed artifacts at HEAD before relaying** — a compacted fixer can claim a PR#/issue# that's stale or plan to re-create one that exists. `gh issue view`/`git ls-remote` first.
4. **Explicitly demand cancellation or redirection of the stale scheduled fallback** — correcting the reasoning is NOT enough if a timer will still fire the stale plan autonomously. Say "cancel or redirect the fallback so it can only do <correct action>, and confirm you neutralized it."
5. **Flag session-health to the parent** (who owns the cross-group restart lever): repeated heavy compactions + autonomous-scheduling-from-stale-state is grounds to consider a fresh, re-briefed fixer session after the current batch drains.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783477748732-a-compacted-fixer-can-schedule-autonomous-actions-.md`_
