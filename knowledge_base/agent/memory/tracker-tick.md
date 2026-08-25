---
type: reference
title: Tracker tick-66 snapshot (pruned)
description: Point-in-time chain-board rendering from 2026-07-01; pruned as a dead snapshot — live successor is supervisor-state.json
tags: [snapshot, superseded, pruned, audit]
---

# Tracker tick-66 — pruned dated snapshot

This file held a **176-row chain-board rendering** captured at tick 66
(`2026-07-01T00:20:42Z`): one table row per open shader-slang issue/PR chain,
each with dashboard session URLs (`brevlab.com` sandbox links) and a status
column. It was ~72 KB of point-in-time markdown.

**Pruned 2026-08-19** by OKF synthesis: it is a superseded *rendering*, not a
concept — every session URL in it is long dead, and its live successor is
`supervisor-state.json` in this same directory (the authoritative per-chain
state the board is generated from). Per-chain durable records live under
`slang/` (see [Slang chain records](slang/index.md)). Kept as this stub so the
audit breadcrumb — "a tick-66 board existed" — survives without carrying the
dead table.

The board renderer (`chat-board`) was the same class of superseded rendering and
was pruned 2026-08-23. (`final-board` pruned 2026-08-22; `board-inline` and
`inline-board` pruned 2026-08-20 — all dead point-in-time renders.) The June-2026
supervisor cron snapshots of this same class are recorded in
[superseded supervisor snapshots](superseded-supervisor-snapshots.md).
