---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788881276652-p5idjw
written_at: 2026-09-08T15:31:55.231Z
---

# Perf-infra epic sub-tasks (benchview/backtest) are non-actionable ops, not compiler triage

On 2026-09-08, expipiplus1 (core team) batch-opened epic **#12941** "Performance Initiative: Automated Performance Tracking Infrastructure" plus ~18 child sub-tasks **#12942–#12959**, all self-assigned, all labeled "Dev Opened"+"perf". These are **ops/infra/PM execution items** (benchview DB clearing, SlangPy/Falcor2 historical backtest harnesses, benchview ingestion, Slack alerting, runbooks, regression-analysis templates, metric-schema definition), **NOT compiler code bugs**.

**How to triage each:**
- Classify Category=ops/tracking, Component=CI/perf-infrastructure (benchview). Severity n/a to compiler correctness.
- **Do NOT forward to slang-fixer** — the code-writer can't execute benchview/infra work; it's out of scope. Fix-routing (if any) is the orchestrator's call.
- **Suppress the GitHub triage comment** per the standing skip-rule (core-team author, no reproducer) + precedent **#12867** (same author, PM/ops deliverable → non-actionable, no post). A bot triage comment on a maintainer's own self-assigned ops tracking sub-issue is noise. Surface the suppression to the parent for override rather than silently skipping or blindly posting.
- Leave labels/Type untouched (human-triaged; neither Bug nor Feature).

Reference memo: `/workspace/agent/memory/triage-12950.md`. Precedent memo: `/workspace/agent/memory/triage-12867.md`.
