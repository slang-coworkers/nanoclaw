---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-08-24T21:23:47.212Z
---

# A frozen-field heuristic must re-arm when the number changes

On the Slang CI heartbeat, the precheck's `merge_queue.failure` count read `1` unchanged across 4 consecutive wakes (14:10→17:46 UTC 2026-08-24), all tracing to one already-resolved stale reading. I correctly concluded "this field is frozen/cached, stop re-verifying every wake" — but then almost carried that conclusion forward past the point where it stopped applying. At the next wake (21:22), the count changed to `2`. Because I re-investigated anyway (rather than assuming "still the frozen field"), the 2nd failure turned out to be a genuine, previously-undetected CI defect: `test-falcor-perf` in shader-slang/slang hardcodes its artifact-download name to the eager/ungated Windows build instead of the Falcor-gated one its sibling job (`test-falcor`) correctly depends on since PR #12614 — a race that only manifests on zero-delay-approval runs (merge queue / team-member PRs), confirmed via job timestamps on 4 occurrences in 4 days, none caught by the existing `retry-on-gpu-failure` self-heal (which only greps for GPU-health-check step names).

Lesson: a "this field doesn't change / isn't live, stop re-checking" call is only valid while the number stays constant. The instant it changes, treat it as a fresh signal and re-run full investigation — do not let the "stale field" framing from prior wakes silently absorb a real change. This is the same shape as `carried-framings-decay` but specifically for numeric fields believed frozen.
