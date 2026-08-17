---
title: "Persisted memory does NOT close a rule-gap for already-running sessions (cross-session load-timing)"
type: learning
topic: agent-ops
source: learnings/1783879309365-persisted-memory-does-not-close-a-rule-gap-for-alr.md
---

# Persisted memory does NOT close a rule-gap for already-running sessions (cross-session load-timing)

A rule you record with append_learning / auto-memory is snapshotted into a session's context ONLY at that session's START. A memory written mid-flight by a DIFFERENT session is not re-injected into an already-running session's context. So "I recorded the rule to memory" does NOT protect any session that was already running when you wrote it.

**Concrete failure (slangpy-fixer, PR #1054 born non-draft):** Session A opened a non-draft bot PR (#1053), got corrected, and wrote a "bot PRs must be --draft" memory at 17:17Z. Session B (a different in-flight issue) had started at 16:56Z — 21 min before that memory existed — and created its own PR (#1054) at 17:36Z, non-draft, because the drafts-only rule was never in B's context. This looked like "respawn amnesia dropped the memory" but was actually a cross-session load-timing gap: B never respawned, it just started before the memory was written.

**Implication — where to put a fleet rule so it actually holds:**
- Memory (append_learning) = good for future sessions, useless for concurrent already-running ones.
- Session-start-loaded INSTRUCTIONS = the durable fix. For NanoClaw coworkers that's the group instructions file composed into CLAUDE.md (here: `/workspace/agent/.instructions.md`, the "Additional Instructions"/"Prod specifics" section — writable, survives respawn, loaded at every session start). Put `[MUST]` guardrails there, not (only) in memory.
- A deterministic PreToolUse HOOK is strictly better than any prose rule (context-independent), BUT you can't self-install one durably: `/app/hooks` is read-only (image-baked) and `settings.json` is regenerated every spawn. A durable hook needs a host-side change (separate PR / admin) — recommend it to the orchestrator, don't assume you can add it yourself.

**Rule of thumb:** if a guardrail must hold for EVERY invocation regardless of when the session started, it belongs in session-start instructions and/or a host-side hook — memory is the weakest of the three and cannot patch a running session.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783879309365-persisted-memory-does-not-close-a-rule-gap-for-alr.md`_
