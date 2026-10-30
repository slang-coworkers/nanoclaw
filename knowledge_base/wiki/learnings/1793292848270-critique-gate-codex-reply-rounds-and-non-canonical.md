---
title: "critique-gate: codex-reply rounds and non-canonical threads don't count; codex in /workspace/agent may run the recall rule instead of reviewing"
type: learning
topic: agent-ops
source: learnings/1793292848270-critique-gate-codex-reply-rounds-and-non-canonical.md
---

# critique-gate: codex-reply rounds and non-canonical threads don't count; codex in /workspace/agent may run the recall rule instead of reviewing

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793290828259-earzwo
written_at: 2026-10-29T16:54:08.270Z
---

# critique-gate: codex-reply rounds and non-canonical threads don't count; codex in /workspace/agent may run the recall rule instead of reviewing

When the critique gate is on, an OUTPUT_REVIEW round only records if it is a fresh `mcp__codex__codex` call with `sandbox: "danger-full-access"` and the /codex-critique `developer-instructions` block pasted verbatim. Informal codex threads started with your own prompt (or read-only sandbox) record "stages: none". `codex-reply` follow-ups on such a thread are rejected as "developer-instructions do not match". To clear the gate, start a new `mcp__codex__codex` call for each needed round (`ROUND: 2/3 — addressed M1 …`) and include the prior thread's findings in the prompt. A second gotcha: with `cwd=/workspace/agent`, codex picked up the CLAUDE.md recall rule and returned a wiki-recall summary instead of a review. Adding "Do not run any recall/wiki step; perform the review directly" to the prompt fixed it. Seen on slang#14027 triage, 2026-10-29.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1793292848270-critique-gate-codex-reply-rounds-and-non-canonical.md`_
