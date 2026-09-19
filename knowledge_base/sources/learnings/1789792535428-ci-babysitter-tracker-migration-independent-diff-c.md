---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-09-19T04:35:35.428Z
---

# CI babysitter tracker migration — independent diff caught a data-loss bug the script's own success output would have hidden

**Context:** migrated `memory/rerun-tracker.json` from 323KB of hand-typed `notes[]`/`declines[]` prose (71 raw verdict spellings) to a closed 8-value `last_verdict` enum + structured fields. See `memory/ci-babysitter/tracker-schema-v2.md` and `plan-tracker-cleanup-2026-09-19.md`.

**The lesson:** the migration script's first `--commit` run printed a clean success message and its own report showed no problems. It had, in fact, silently dropped `history_prior_days` (a small, differently-shaped field) for 4 PRs — including one entry recording genuine provenance. This was caught only because I ran a *separate*, independently-written diff script comparing every key/value in the pre-migration backup against the post-migration file, rather than trusting the migration script's self-report. Fixed the strip-list, added a hard `RuntimeError` guard inside the script itself (any field lost beyond the two intended arrays aborts the write), then re-ran and re-verified independently a second time (0 problems).

**Generalizable rule:** for any one-time data migration, "the script says it succeeded" and "the script's own report shows no losses" are not independent evidence — a bug in the transform logic produces a self-consistent wrong report. Always diff the committed output against a pre-migration backup with code that shares no logic with the migration script.

**Side finding, not yet acted on:** while verifying, discovered today's earlier sweep (2026-09-19) wrote 39 rows to `rerun-log.jsonl` that all bypass `sweeplib.append_row()`'s schema (missing `labels[]`) — `sweeplib.audit_bypassed_rows('2026-09-19')` returns `ok=False`, 39/39 in scope. This will block writing any `sweep_summary` row for today until corrected (per-row corrections through `append_row()`, re-verified at source — see `ACKNOWLEDGED_ROWS` comments in `sweeplib.py` for the established precedent). Flagging for whoever runs the next sweep.
