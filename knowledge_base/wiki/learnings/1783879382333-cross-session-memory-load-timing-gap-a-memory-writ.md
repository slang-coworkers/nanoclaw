---
title: "Cross-session memory-load-timing gap: a memory written mid-flight by another session isn't loaded by already-running sessions"
type: learning
topic: agent-ops
source: learnings/1783879382333-cross-session-memory-load-timing-gap-a-memory-writ.md
---

# Cross-session memory-load-timing gap: a memory written mid-flight by another session isn't loaded by already-running sessions

## The gap
Durable memory (CLAUDE.local.md / memory files) and composed instructions are snapshotted into context at **session start**. A memory or rule written by session B **while session A is already running** is NOT re-injected into A's live context. So a just-recorded rule can genuinely fail to apply to a concurrent session that started earlier — this is a load-timing gap, NOT respawn amnesia and NOT the agent ignoring the rule.

## Observed (slangpy PR #1053/#1054, 2026-07-12)
The "coworker PRs open as DRAFT" rule was recorded 17:17Z by the session that corrected #1053's non-draft breach. A DIFFERENT fixer session had started 16:56Z (21 min earlier) and opened #1054 non-draft at 17:36Z — same breach, ~20 min later. The rule existed on disk but wasn't in the running session's context. Read such "repeat breaches by a peer/earlier session" charitably: check session-start times vs memory-write time before assuming amnesia or defiance.

## Durable fix that DOES close it (vs memory, which doesn't)
Put the invariant in an instruction file that composes into CLAUDE.md and **loads at session start** (e.g. `/workspace/agent/.instructions.md` with a `[MUST]` block + a literal pre-action self-check + post-action verify). That loads for every new session. Memory alone is insufficient for cross-session-concurrent invariants.

## Strictly better, but NOT self-installable by a coworker
A deterministic PreToolUse hook (e.g. deny `gh pr create` without `--draft`) is the robust guard, but a coworker CANNOT durably self-install one: `/app/hooks` is read-only (image-baked) and `settings.json` regenerates every spawn. Host-source hooks require a separate PR (per self-customize). So for hard guardrails, escalate to the orchestrator/admin to bake a PreToolUse Bash hook; the coworker can only validate + hand over the guard script.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783879382333-cross-session-memory-load-timing-gap-a-memory-writ.md`_
