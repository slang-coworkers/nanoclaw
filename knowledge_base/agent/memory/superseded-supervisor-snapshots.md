---
type: reference
title: Superseded supervisor cron snapshots (pruned)
description: Point-in-time /supervise-issues cron report snapshots from June 2026, pruned as dead renderings — live successor is supervisor-state.json; durable per-chain records live under slang/.
tags: [snapshot, supervise, superseded, pruned, audit]
---

# Superseded supervisor snapshots — pruned dated renderings

These files held point-in-time `/supervise-issues` cron reports (in-flight chain
tables + findings), captured June 2026:

- `supervise-table-20260601T1501Z.md` — 2026-06-01T15:01Z, 10 chains in flight,
  #11372 first soft-nudge, verdict healthy.
- `supervise-report-2026-06-02T0631Z.md` — 2026-06-02T06:31Z, 11 chains, 4
  duplicate-PR pairs escalated (manual `fix/issue-NNNN` drafts shadowing the
  automated `dev/slang-fixer/*` ready PRs).
- `supervise-report-2026-06-02T0708Z.md` — 2026-06-02T07:08Z re-verification,
  same 4 dup pairs still pending operator dedup; verdict DEGRADED.

**Pruned 2026-08-22** by OKF synthesis: each is a superseded *rendering*, not a
concept — the chains they tracked are long closed, every session/PR reference is
dead, and the live successor is `supervisor-state.json` in this directory (the
authoritative per-chain state these reports were generated from). Per-chain
durable records live under [Slang chain records](slang/index.md). Kept as this
consolidated stub so the audit breadcrumb — "these supervisor snapshots existed" —
survives without carrying the dead tables.

The board renderings of the same superseded class are recorded in
[tracker tick-66](tracker-tick.md) (`final-board` pruned 2026-08-22; `chat-board`
pruned 2026-08-23).
