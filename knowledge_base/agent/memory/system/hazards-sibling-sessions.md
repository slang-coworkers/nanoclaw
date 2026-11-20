---
type: system
title: Sibling Main session hazards
description: Measured duplicate-owner and parallel-sibling races — dual dispatch on coworker filings, sibling dashboard reports, the turn-start grep race, and the self-session false sibling.
---

# Sibling Main session hazards

⚠️ **2026-10-30, slangpy#1250: a babysitter filing that I learn of from a sweep report also mints a canonical Main session through its `issue_opened` webhook, and that session dispatches too.** The babysitter's 00:06Z report reached my non-canonical session (`jmv3wy`, which the pinned-send reroute sends sweeps to). The `issue_opened` webhook had already minted `qsff21` on `gh-issue-shader-slang/slangpy-1250` at 00:02Z, and it dispatched slangpy-triager at 00:04Z. I dispatched slangpy-fixer at 00:07Z without checking. Result: two Main parents. The fixer's replies went to `qsff21`, a "who directed this" mix-up had to be corrected and retracted, and both sessions reported to the operator. ⇒ **Before dispatching on any issue a coworker has just filed, run `ncl sessions list --limit 10000 | grep <repo>-<N>`. If a Main session already exists on the canonical thread, it owns the issue; send nothing.**

## Sibling Main sessions also report owed items to the dashboard (2026-11-02/03, #14200 chain)

Several Main sessions can take the same chain's inbound, and each one sees the same "owed: report X to
dashboard" line in the chain record. On #14200 this caused a duplicate dashboard row twice: the
20:44Z new-chain ack, and the #14213 filing report (sibling at 00:04Z, mine at 00:11Z).
**Before sending an owed report, read the last ~10 rows of the dashboard session**
(`ncl sessions messages sess-1776713576150-9fon2n --reverse --json --limit 10`). After sending, mark the
owed item closed in the chain record **with the seq**, so the next session can see it was delivered.

## The turn-start grep can miss a record a sibling writes moments later (2026-11-03, #14261)

The #14251 fixer filed four follow-ups (#14261–#14264) at once. Each `issue_opened` webhook minted its own Main
session, and the Main session that received the fixer's `[Report]` decided all four together. My turn-start
`grep -rl 14261 memory/slang/` returned nothing at ~21:49Z, but the sibling wrote `14261-*.md` (filed-only,
"siblings must NOT dispatch") at 21:50Z. I had already drafted a fixer dispatch, and I saw the record only
because I happened to read `slang/index.md` again. ⇒ **When an issue is one of a batch a coworker has just
filed, run `ls memory/slang/<N>-*` again immediately before sending any dispatch.**

## Before treating an active session row as a "parallel sibling", compare it to NANOCLAW_SESSION_ID (2026-11-17)

On the #14537 `issue_opened` webhook I found an "active running" Orchestrator-group session on the very thread
(`sess-1794907035474-s748hh`, created the same minute as the webhook) and spent ~10 min polling it as a sibling that
"might already be handling this" — no outbound rows, no 👀, nothing. It was **my own session**: `env | grep
NANOCLAW_SESSION_ID` matched the row exactly. last_active advancing each poll was *my* tool calls.

⇒ **First check on any "duplicate owner" suspicion: `printenv NANOCLAW_SESSION_ID` vs the suspect row id.** A webhook
turn's own session row is always "running" on the webhook's canonical thread and will never show outbound rows until the
final response lands. The infra-alert-dedupe rule ("check what others posted before posting") applies to *other*
sessions' artifacts (GitHub reactions/comments, task rows) — not to watching a session that is yourself.
