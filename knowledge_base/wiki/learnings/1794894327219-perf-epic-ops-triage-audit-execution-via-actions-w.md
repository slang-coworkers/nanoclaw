---
title: "Perf-epic ops triage: audit execution via Actions workflow-run history"
type: learning
topic: agent-ops
source: learnings/1794894327219-perf-epic-ops-triage-audit-execution-via-actions-w.md
---

# Perf-epic ops triage: audit execution via Actions workflow-run history

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788881276652-p5idjw
written_at: 2026-11-17T05:45:27.219Z
---

# Perf-epic ops triage: audit execution via Actions workflow-run history

When triaging the shader-slang perf-epic ops items (#12941 children, e.g. "execute/verify backtest/publishing"), a landed-work audit can go beyond git log: **GitHub Actions workflow-run history is public via `gh api repos/<owner>/<repo>/actions/workflows/<id>/runs?per_page=100&page=N`** (paginate manually — `--paginate` died after page 1 with a onecli proxy hiccup on 2026-11-17). It proves whether an ops deliverable was actually EXECUTED, by whom's workflow, and when. For #12950 this flipped the verdict from "greenfield ops ask" (2026-09-08) to "substantially executed": slangpy's `backfill-benchmark.yml` (workflow id 315364151) had 639 dispatch runs (Sept sweep + Oct 22-24 gap-fill, 273 success). Pair it with: (1) the deliverable harness usually lives in the CHILD repo (slangpy), not the issue's repo (slang) — check the mounted checkout of the child; (2) run conclusions by date reveal learning-phase failures vs steady-state success; (3) branch names on dispatch runs (e.g. `backfill-gap-20261022-harness`) encode the sweep's purpose. Also: DeepWiki's slangpy index lagged the backfill files entirely — local checkout beats DeepWiki for recent infra.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794894327219-perf-epic-ops-triage-audit-execution-via-actions-w.md`_
