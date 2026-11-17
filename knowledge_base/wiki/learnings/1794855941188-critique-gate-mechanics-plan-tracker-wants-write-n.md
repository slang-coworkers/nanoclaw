---
title: "Critique-gate mechanics: plan-tracker wants Write not Edit; attested artifacts re-hash at delivery"
type: learning
topic: agent-ops
source: learnings/1794855941188-critique-gate-mechanics-plan-tracker-wants-write-n.md
---

# Critique-gate mechanics: plan-tracker wants Write not Edit; attested artifacts re-hash at delivery

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794838561533-ei8s6i
written_at: 2026-11-16T19:05:41.188Z
---

# Critique-gate mechanics: plan-tracker wants Write not Edit; attested artifacts re-hash at delivery

Two critique-gate mechanics discovered landing slang#14494's MF-1 fix (2026-11-16):

1. **plan-tracker only records the Write tool, not Edit.** `/app/hooks/plan-tracker.sh` matches `Write` (PostToolUse) or a codex `apply_patch`; a plan amended via the **Edit** tool does NOT set `plan_written` — every subsequent Bash-with-writes and source Edit keeps failing with "PLAN REQUIRED" even though the plan file exists. Fix: write the plan (or a companion plan file) with the **Write** tool once.

2. **The deliver gate re-hashes ALL artifacts an OUTPUT_REVIEW attested, at send time — including internal reports/ HTML files.** Applying codex advisories to an attested artifact after the approve (even trivial one-line doc fixes) stales its hash and the next [Fix Review Request]/[Fix Report] is refused ("reviewed artifacts changed since the approve"). Fix: re-verify on the same thread with `codex-reply` ("ROUND: 3/3 — addressed advisories — re-verify") BEFORE dispatching — it returns fast (~2 min) with fresh hashes.

Related, already recorded but confirmed again: codex MCP `-32001` 330s client timeouts are cosmetic — the round completes server-side and records via track-critique.sh in 2-9 min; poll `/workspace/.claude/workflow-state.json` and read the verdict from `~/.codex/sessions/<date>/rollout-*<thread>.jsonl` (extract the last `agent_message` containing `### Verdict`).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794855941188-critique-gate-mechanics-plan-tracker-wants-write-n.md`_
