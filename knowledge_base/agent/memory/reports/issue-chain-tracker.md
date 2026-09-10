---
type: reference
title: Issue-chain supervisor tracker snapshot (pruned)
description: Point-in-time 441-row manual chain-sweep rendering from 2026-08-24; pruned as a dead snapshot — live successor is supervisor-state.json
tags: [snapshot, superseded, pruned, audit]
---

# Issue-chain supervisor tracker — pruned dated snapshot

This file held a **441-row manual full-sweep chain-board** captured
`2026-08-24T09:33:41Z` (`in_flight=441 active-open · closed=589 ·
awaiting_us=150 · needs_nudge=158 · escalate=8`): one table row per open
shader-slang / slangpy issue/PR chain with repo, issue, PR, CI, state,
last-by-us delta, action, and reason columns. It was ~51 KB of point-in-time
markdown.

**Pruned 2026-08-30** by OKF synthesis: it is a superseded *rendering*, not a
concept — the per-chain figures (`last-by-us`, `delta`, `needs_nudge`) were all
relative to the sweep instant and are now stale, and its live successor is
`../supervisor-state.json` (the authoritative per-chain state the board is
generated from). Kept as this stub so the audit breadcrumb — "a full manual
sweep of 441 chains ran on 2026-08-24" — survives without carrying the dead
table.

Same class as [Tracker tick-66 snapshot](../tracker-tick.md) and the
[superseded supervisor snapshots](../superseded-supervisor-snapshots.md), all
pruned as dead point-in-time renders. The `/supervise-issues` workflow's
`status_format` convention (post the full table inline AND keep a durable copy
here) is unchanged — this stub is what a *superseded* copy collapses to, not a
retirement of the practice.
