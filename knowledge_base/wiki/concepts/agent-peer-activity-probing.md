---
title: "Peer Activity Probing: Spend, In-Flight Turns, and Split Transcripts"
type: concept
group: agent-ops
tags: [session-probing, activity, spend, transcripts, recheck-sessions, staleness, escalation]
---

# Peer activity probing: spend, in-flight turns, and split transcripts

How to answer "is the peer (fixer, triager, sibling session) actually alive and working?" without
producing false "dead"/"idle" escalations or wasted re-sends. Routing and phantom-session mechanics live
on [multi-session coordination](agent-infra-multi-session-coordination.md).

## TL;DR

- **Outbound-row timestamps stamp turn START, not delivery** — an answer turn in flight reads as "no
  activity." A peer's fresh unanswered inbound means "possibly in flight," not "ignored." Only declare a
  chain dead once the turn is observably finished (terminal output, error row, or timeout well past
  expected duration).
- **A thread transcript can be split across sessions.** `ncl sessions list | grep -i <N>` and read ALL
  related sessions (recheck/task sessions included), newest first, before concluding "no inbound since
  <time>"; the nominal thread session may hold only the early part of the conversation.
- **Judge fixer health from sibling recheck sessions' final rows, not from silence.** "No new failure
  notice" is ambiguous; a recheck session's closing rows ("fixer chain RECOVERED") are positive evidence.
- **Spend is the dead-wake detector:** `ncl cost-cap status --session <sid>` — cost unchanged with no out
  rows for >20 min means no turn ever started, even with zero canned errors.
- **A transcript only shows messages sent from THAT session** — a retry sent from a task session never
  appears in the original thread session's transcript, so transcript absence is not delivery failure.
- **Doomed fixer wakes fail fast:** a provider-outage wake emits its canned error within ≤10 min of the
  trigger, so 20+ min of silence after a retry is evidence AGAINST another fast failure.

## In-flight answer turns look like "no activity"

The out row is stamped at turn START, so an answer turn still running shows no new outbound rows. On
slang-triager (2026-11-17, #14354) an 08:30Z probe read "no fixer activity since 06:23Z" and escalated as
blocked while the fixer's answer turn had been running since 08:12:31 and delivered a complete fix minutes
later. Before declaring a chain dead/idle (or escalating "blocked on peer runtime"), check whether a
recent inbound (nudge, supervisor ping) could have started a still-running turn — treat a peer's fresh
un-answered inbound as in-flight unless the turn is observably finished
([peer-session probes: in-flight answer turns look like "no activity"](../learnings/1794904595008-peer-session-probes-in-flight-answer-turns-look-li.md)).

## Thread transcripts split across sessions

When re-checking a chain via `ncl sessions messages`, the nominal thread session may NOT carry the whole
conversation: on the 13837 chain its transcript stopped at 06:27 while the live fixer exchange (msgs
26–47, 08:51Z–09:30Z) lived in the earlier recheck task session
(`system:tasks:i13837-fixer-recheck-f206`). Run `ncl sessions list | grep -i <N>` and read the transcripts
of ALL related sessions (recheck/task sessions included), newest first, before concluding "no inbound
since <time>" — a false "silent" reading wrongly triggers (or skips) an escalation. Also: a session's
`last_active` reflects message arrival even when the transcript endpoint shows nothing new for that
session ([ncl thread transcripts can be split across sessions](../learnings/1794911662936-ncl-thread-transcripts-can-be-split-across-session.md)).

## Read sibling recheck sessions for positive evidence

When a one-shot re-check must decide whether a coworker (e.g. slang-fixer) "appears healthy" after crash
incidents, don't guess from silence — check sibling recheck sessions first:
`ncl sessions list | grep -i recheck`, then `ncl sessions history <sess-id> --limit 6` on one or two
recent `recheck-*-fixer-*` sessions; their final chat rows state directly whether the fixer
restarted/recovered (2026-11-17: "fixer chain RECOVERED", "Fixer visibly restarted: draft PR #14525").
That turned an ambiguous "no new failure notice" into positive evidence in seconds and prevented a wasted
4th handoff during the crash window. Gate note for task sessions: the chain-initiating inbound is the task
prompt itself (seq 2), so `in_reply_to=2` + explicit `to` + canonical `thread_id` satisfies
gate-chain-routing for [Triage handoff]/[Report] sends from a task session
([fixer health check for re-sends: read sibling recheck sessions, not silence](../learnings/1794900425006-fixer-health-check-for-re-sends-read-sibling-reche.md);
task-session send recipes on [the send gate](agent-routing-send-gate-in-reply-to.md)).

**Source learnings (3):**
- [in-flight answer turns look like "no activity"](../learnings/1794904595008-peer-session-probes-in-flight-answer-turns-look-li.md) — out rows stamp turn start; unanswered fresh inbound = possibly in flight.
- [thread transcripts can be split across sessions](../learnings/1794911662936-ncl-thread-transcripts-can-be-split-across-session.md) — grep all sessions matching the issue before reading "silent".
- [fixer health check: read sibling recheck sessions](../learnings/1794900425006-fixer-health-check-for-re-sends-read-sibling-reche.md) — recheck sessions' final rows are positive recovery evidence; task-session in_reply_to=2.

_Catalog: [[wiki/index.md]]_
