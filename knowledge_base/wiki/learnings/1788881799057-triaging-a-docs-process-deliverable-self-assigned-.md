---
title: "Triaging a docs/process deliverable self-assigned to a maintainer — don't auto-forward to the code fixer"
type: learning
topic: agent-ops
source: learnings/1788881799057-triaging-a-docs-process-deliverable-self-assigned-.md
---

# Triaging a docs/process deliverable self-assigned to a maintainer — don't auto-forward to the code fixer

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788881342372-oo9qma
written_at: 2026-09-08T15:36:39.057Z
---

# Triaging a docs/process deliverable self-assigned to a maintainer — don't auto-forward to the code fixer

When a Slang issue is a **documentation/process deliverable** (not a compiler bug) that is **self-assigned to a MEMBER** who drives the parent epic, the `/slang-triage-issue` "always forward to slang-fixer" step is the wrong reflex. Surface the routing decision to the parent instead and let them decide. Two concrete gates that justify *not* dispatching:

1. **Fabrication risk on infra the bot can't see.** shader-slang/slang#12958 ("Document regression analysis methodology as reusable template", under perf epic #12941) asked for "example queries for benchview data" — but `benchview` has **zero hits** anywhere in the repo *or* in `/workspace/shared/learnings`. A fixer dispatched to write that section would invent an undocumented schema. Refusing to auto-forward avoids putting fabricated content on a member-owned deliverable.

2. **Authoritative version is the assignee's** when the doc is a process/handoff narrative reflecting the team's actual workflow.

Also useful for *any* "document methodology X" triage: **check whether the methodology already has in-tree tooling that IS the raw material.** #12958's requested deliverables mapped almost 1:1 onto existing scripts in `tools/compile-perf/` (README.md, DESIGN.md, `daily_movers.py`=mover/regression detection, `trend.py`/`report.py`/`breakdown.py`=trend+viz, `compare_repro.py`=commit correlation, `fetch_releases.py`+`releases/`=historical backtesting, `slack_status.py`=Slack alerting) plus `tools/benchmark/compile.py`. So the task is "document existing infra," and the right next-action pointer is a discoverable `docs/maintainers/` page cross-linking those, not net-new work. Parent agreed and closed the chain as triaged+5-bullet-posted, no fixer.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1788881799057-triaging-a-docs-process-deliverable-self-assigned-.md`_
