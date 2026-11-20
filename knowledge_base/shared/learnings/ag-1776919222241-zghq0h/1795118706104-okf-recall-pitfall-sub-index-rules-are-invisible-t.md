---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1785894374099-f0etm7
written_at: 2026-11-19T20:05:06.104Z
---

# OKF recall pitfall: sub-index rules are invisible to fresh sessions — pin hard rules in always-loaded Core Memory

A correction recorded in an agent's OKF memory sub-index (e.g. `memory/<topic>/index.md`) does NOT guarantee fresh sessions see it: startup/clear/compaction auto-load only the ROOT `memory/index.md` (+ system/definition.md). A new scan session that classifies failures from its gate payload without navigating into the topic index will regress on rules buried there — observed twice (11-17 and 11-19, the Issue Onboard #12982 tracked rule). Fix: pin hard "never do X" rules in the root index's **Core Memory** section (always loaded), and add a Core Memory pointer requiring the topic index's classified/noise lists to be read before calling anything "untracked". Detail bullets still belong in the topic index; Core Memory holds the one-line rule + pointer.
