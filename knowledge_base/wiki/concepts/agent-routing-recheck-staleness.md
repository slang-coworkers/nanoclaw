---
title: "Agent Routing: Re-Check Staleness and Gated One-Shots"
type: concept
group: agent-routing
tags: [re-check, staleness, one-shot, gated-task, infra-outage, ncl-tasks, hold-off, parking]
source_count: 5
---

# Agent Routing: Re-Check Staleness and Gated One-Shots

A scheduled one-shot re-check prompt is a snapshot written at scheduling time, not a description of the world when it fires. Its facts — PR state, resume triggers, operator hold-offs, escalation status — can be hours stale; and when an infra outage blocks all work, the right parking instrument is a gated one-shot, not a recurrence.

## TL;DR
- A one-shot re-check prompt embeds the operator's context from scheduling time. Its facts (PR state, triggers, hold-offs) can be out of date within hours — never act straight from the prompt text.
- On every fire, re-query each resume trigger live with gh (PR state/mergedAt, comments after the last known comment id, timeline cross-refs on the tracking issue), and cross-check the issue's memory page for newer sibling notes.
- Reconcile the prompt against the live chain-state page (`memory/issues/<N>.md`) and thread transcript before acting: a literal "re-nudge now" instruction may contradict a newer hold-off sent after the task was armed.
- Lift a hold-off only when evidence shows the condition cleared (e.g. provider capacity recovered), and phrase the re-nudge to explicitly lift the hold-off so the peer isn't left with contradictory instructions.
- Escalation conditions may already be satisfied-and-delivered — send deltas, not re-pastes.
- For infra outages, park with ONE gated one-shot, not a recurrence: `ncl tasks create --process-after <+3h> --script '<gate>'` printing `{"wakeAgent": false}` while the outage persists — each fired-but-gated run costs ZERO tokens.
- Put the full handling instructions (the decision table to apply once access returns) in the task prompt, and state "do not reschedule more than once" so the woken agent doesn't spin up a poll loop.
- Report blocked to the parent naming the decision owner before ending the turn.
- `ask_user_question(timeout: 0)` can itself fail with `MCP error -32001` — don't retry it in a loop; fall through to parking.
- `ncl tasks update` cannot reschedule the series that is currently running you ("no live task matched") — schedule a FRESH one-shot via `ncl tasks create --process-after` instead.
- A fired one-shot that died (e.g. a 429) is consumed like a success: it vanishes from `ncl tasks list` and the ONLY trace is the run log at `tasks/<series-id>.md` — "gone from list" means "fired", not "ran".

## Re-check prompts go stale — verify every trigger live

A one-shot re-check task is written when it is scheduled, and its facts can go stale before it fires. On slang#13689 the re-check prompt said PR #13943 was "OPEN, CHANGES_REQUESTED on 10-28", but the PR had merged that same evening and the trigger "#13943 merged" had fired long before the re-check ran — so on every fire, query each resume trigger again with gh (PR state/mergedAt, comments after the last known comment id, cross-refs on the tracking issue), and cross-check the issue's memory page, which may hold a newer note from a sibling chain ([Parked re-check prompts go stale: check every trigger live](../learnings/1794384180737-parked-re-check-prompts-go-stale-check-every-trigg.md)). The same staleness bites hold-offs: the 04:45-armed recheck for slang#14518 fired at 06:00 after two more 429s and a hold-off decision had happened at 05:15/05:20 — so before acting, read the issue's live chain-state page and the thread transcript and reconcile; lift the hold-off only when evidence shows the condition cleared (own turns and fleet sessions running normally again), phrase the re-nudge to explicitly lift the hold-off, and when the escalation condition was already satisfied-and-delivered (parent report at 05:20), send deltas, not re-pastes ([Scheduled re-check prompts go stale — reconcile with live chain-state first](../learnings/1794895267498-scheduled-re-check-prompts-go-stale-reconcile-with.md)).

## Gated one-shot for infra outages (GitHub 401 pattern)

When an infra outage blocks all work — e.g. a gateway GitHub credential 401 killing `gh`, curl-via-proxy AND `git fetch` at once, because the gateway injects the bad token everywhere so even unauthenticated-safe reads fail — the parked-handler pattern works: (1) `ask_user_question(timeout: 0)` can itself fail with `MCP error -32001: Request timed out` even at timeout 0 — don't retry it in a loop, fall through to parking. (2) Park with ONE gated one-shot, not a recurrence: `ncl tasks create --process-after <+3h> --script '<curl gate>'` where the script prints `{"wakeAgent": false}` while the outage persists — each fired-but-gated run costs ZERO tokens, so a one-shot won't burn context while the operator is away. (3) Put the full handling instructions (the decision table to apply once access returns) in the task prompt, and state "do not reschedule more than once" so the woken agent doesn't spin up a poll loop. (4) Report blocked to the parent naming the decision owner before ending the turn. Measured 2026-11-16 on slang-fixer during the GitHub 401 outage (PR #13679 ci_failed parked as `gh-cred-recheck-13679-990d`) ([Gated one-shot re-check for infra outages](../learnings/1794814589163-gated-one-shot-re-check-for-infra-outages-github-4.md)).

## One-shot scheduling mechanics: updating a live series, and silent failures

`ncl tasks update --id t-<own-series>` fails with "no live task matched" when that series is the task
currently running you — a running task is not live for update, so to reschedule a retry, `ncl tasks
create --name <new> --process-after <+1h>` a fresh one-shot and fold prior context into its prompt
([ncl tasks update cannot reschedule the running task itself](../learnings/1794923530167-ncl-tasks-update-cannot-reschedule-the-running-tas.md)).
And a one-shot that fires and then dies (e.g. "API Error: Request rejected (429)") is CONSUMED like a
successful run: it disappears from `ncl tasks list`, and the only trace is the run log at
`tasks/<series-id>.md`, often a single error line. "Task gone from the list" means "re-check fired", never
"re-check ran" — when re-engaging a parked chain after a scheduled re-check's due date, always open
`tasks/<id>.md` to confirm the run completed before assuming the chain was checked (on slang#13995 the
11-13 re-check had silently failed with a 429, leaving the issue un-checked for 4+ days)
([one-shot ncl task failures are silent — check tasks/<id>.md](../learnings/1794947920360-one-shot-ncl-task-failures-are-silent-check-tasks-.md)).

**Source learnings (5):**
- [Parked re-check prompts go stale — check triggers live](../learnings/1794384180737-parked-re-check-prompts-go-stale-check-every-trigg.md)
- [Scheduled re-check prompts stale — reconcile with chain-state](../learnings/1794895267498-scheduled-re-check-prompts-go-stale-reconcile-with.md)
- [Gated one-shot re-check for infra outages (401)](../learnings/1794814589163-gated-one-shot-re-check-for-infra-outages-github-4.md)
- [ncl tasks update cannot reschedule the running task itself](../learnings/1794923530167-ncl-tasks-update-cannot-reschedule-the-running-tas.md) — create a fresh one-shot instead
- [one-shot ncl task failures are silent](../learnings/1794947920360-one-shot-ncl-task-failures-are-silent-check-tasks-.md) — check tasks/<id>.md; gone from list = fired, not ran

_Catalog: [[wiki/index.md]]_
