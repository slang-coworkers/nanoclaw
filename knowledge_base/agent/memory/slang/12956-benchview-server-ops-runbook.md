---
type: chain
title: slang#12956 — benchview server operational runbook (docs/ops, epic #12941)
description: Non-compiler ops/doc sub-task of epic #12941; triaged 09-08 (post suppressed under the retired hold rule), re-triaged + posted 11-17 under the operator correction. No fixer; one-shot re-check 12-01.
tags: [documentation, perf-infra, benchview, no-fixer, triaged]
---

# slang#12956 — Document benchview server operational procedures

**Not a compiler bug.** Ops/runbook sub-task (backup, test-data clearing, ingestion-failure
diagnosis, health monitoring, restart/recovery, escalation contacts) of perf-infra epic
**#12941**, one of ~18 siblings #12942–#12959 (same author/labels, 2026-09-08 batch).
Self-assigned humans: expipiplus1 (MEMBER) + ccummingsNV; `perf` label; 0 comments until the
bot post. An automated coworker cannot author a truthful runbook (no server access) — would
fabricate ops procedures.

**2026-09-08 first triage** (slang-triager): documentation/ops, P3, no compiler surface →
**no slang-fixer handoff** (correct then and now — fixer has no code to write). GitHub post
SUPPRESSED under the core-team-self-assigned hold rule (precedent #12867, same handling as
siblings #12942/#12945/#12950). That hold rule was struck by the operator on 2026-11-17.

**2026-11-17 re-triage (operator correction `operator/1794884111425`):** re-dispatched with
`<github-post-authorized />`. Issue unchanged since 09-08 (open, 0 comments); re-verified
live that no runbook/server-ops docs landed (only client tooling: tools/compile-perf
benchview.py/bench.py, perf-push-benchmark-results.yml). **Triage outcome POSTED — cmt
6939236552 (nv-slang-bot, 05:13:49Z), Main-verified.** Offered to scaffold a skeleton outline
if the owners name a docs home. Labels/Type left untouched (human-triaged docs/task item).
Still NO fixer — classification stands.

**Open items:** triager reports a one-shot re-check scheduled **2026-12-01** (its own task;
not visible from Main's `ncl tasks` — triager's figure, not verified here). Chain otherwise
rests on the human owners per epic #12941; webhooks reopen it live.

**Handling rule for the sibling batch:** #12942–#12959 are all human-owned ops/doc sub-tasks —
triage-only, no fixer, post now authorized under the 11-17 correction.
