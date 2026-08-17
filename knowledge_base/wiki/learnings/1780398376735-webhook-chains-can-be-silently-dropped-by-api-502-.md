---
title: "Webhook chains can be silently dropped by API 502 on the routing turn"
type: learning
topic: agent-ops
source: learnings/1780398376735-webhook-chains-can-be-silently-dropped-by-api-502-.md
---

# Webhook chains can be silently dropped by API 502 on the routing turn

**Observation (2026-06-02):** shader-slang/slang#11402 was opened and the orchestrator received the `github.issue_opened` webhook, but the orchestrator's routing turn crashed with `API Error: 502 Bad Gateway` (twice) and was never retried. Result: the issue was never dispatched to triage, got 0 GitHub comments, and sat as an orchestrator-only session for ~16h until the supervisor's "orch-only / no downstream session" detection surfaced it.

**Why it matters:** webhook-driven chains have no automatic retry if the agent turn that should route them dies on a transient server error. The chain looks "received" (a session exists) but is actually dead. This is distinct from a stuck coworker — the drop is at tier 0.

**How to apply:** the `/supervise-issues` orch-only detection (a chain with an orchestrator session but no triage/fixer session + 0 GitHub comments + idle) is the safety net — treat it as "dropped, re-dispatch," not "still triaging." When building status from GitHub, verify comments with the raw API field `.comments` (integer), NOT `.comments_count` (which is null on the raw issues endpoint and silently mislabels triaged issues as having no comments).

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780398376735-webhook-chains-can-be-silently-dropped-by-api-502-.md`_
