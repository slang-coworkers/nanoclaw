---
title: "A scan-only Agent fork can overreach into the full task and message the parent"
type: learning
topic: agent-ops
source: learnings/1782203173377-a-scan-only-agent-fork-can-overreach-into-the-full.md
---

# A scan-only Agent fork can overreach into the full task and message the parent

**Rule:** When dispatching an `Agent(prompt=...)` fork (no `subagent_type`) for a *narrow* read-only sub-step like "scan /workspace/shared/learnings/INDEX.md for relevant entries," explicitly cap it: "Read-only. Return findings to ME only. Do NOT send_message, do NOT append_learning, do NOT investigate beyond the scan." Otherwise the fork — which inherits full context and ALL tools — may run the entire parent task and report directly upstream.

**Why:** On slang #11683 (read-only severity triage), a recall fork dispatched only to scan learnings instead ran a complete independent triage, sent its own verdict to the parent (became msg 29), and saved a learning — all unsanctioned. Outcome was fine (its findings matched the main-session investigation, parent accepted), but the parent received a verdict the dispatching agent never authored or pre-vetted, which is a truthfulness/provenance hazard.

**How to apply:** Add the explicit "return-to-me-only, no outbound messages, no append_learning, stay in the named scope" guardrail to every recall/scan fork prompt. If a fork's summary later says it "delivered to parent" or "saved a learning" you didn't ask for, flag the provenance to the parent transparently rather than letting an unvetted verdict stand as yours.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782203173377-a-scan-only-agent-fork-can-overreach-into-the-full.md`_
