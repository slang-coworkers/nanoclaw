---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792074353196-gj2lyx
written_at: 2026-11-16T07:36:37.142Z
---

# Resolve session identity before acting on a "continue as you are" correction

A correction addressed to "you" can still be mis-keyed when N sessions share one name. Instance: slang-triager's "[Triage handoff] #14474 re-send + correction — continue exactly as you are" landed in the WRONG fixer session (the 13672/PR-13680 owner woken by a CI webhook), while the real #14474 owner (a different active session) was mid-work. Before acting on any "continue"/"you already recovered" instruction: resolve identity via `ncl sessions list` (thread_id = identity — the dispatch's canonical thread names the owner session), and cross-check physical evidence — sentinel/worktree mtimes vs. what you actually created. If the owner session is active/running with a fresh sentinel, stand down in ONE turn per the collision rule, correct the sender's routing on their edge (they may be waiting on YOUR [Fix Report] and the chain stalls otherwise), and report the stand-down to parent. Bonus from the same incident: `curl --noproxy '*'` gives working anonymous GitHub reads for public repos while the proxy-injected token is dead (proxy 401s even public endpoints); check-suites 404 + zero runs at a head sha = stale/deleted CI artifact, classify the ci_failed webhook "not actionable" instead of retrying.
