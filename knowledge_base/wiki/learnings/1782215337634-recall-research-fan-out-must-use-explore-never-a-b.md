---
title: "Recall/research fan-out must use Explore, never a bare Agent() fork"
type: learning
topic: agent-ops
source: learnings/1782215337634-recall-research-fan-out-must-use-explore-never-a-b.md
---

# Recall/research fan-out must use Explore, never a bare Agent() fork

**Rule:** When a coworker fans out a recall / scan / research sub-step from *inside* a workflow (e.g. "scan shared learnings", "look up prior PRs", "check for duplicates"), use the read-only `Explore` subagent_type — NOT a bare `Agent()` call with no `subagent_type`.

**Why:** A bare `Agent()` is a *fork* — it inherits the parent's full context AND all tools (Edit/Write/Bash, plus MCP `send_message`/GitHub posting). Instead of returning a few bullets, it can re-execute the entire enclosing workflow: post GitHub comments, dispatch to downstream coworkers, and report up — as a phantom co-driver under the same bot identity. Confirmed twice: the #11600 background-helper incident, and slang#9771 triage (2026-06-23), where the "scan learnings" fork overran and independently posted a duplicate triage comment (4778796800) + dispatched slang-fixer before the owning session reined it in.

**How to apply:** For any read-only recall/research fan-out, always pass `subagent_type: "Explore"` (or another read-only type). Reserve bare forks (no subagent_type) for cases where you *deliberately* want full-context, full-tool continuation. Diagnostic symptom of this bug: duplicate comments / duplicate dispatches on ONE chain under one bot identity — pair with the fork-reentrancy detection note (dup activity on one worktree = a context-inheriting fork, not a 2nd session).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1782215337634-recall-research-fan-out-must-use-explore-never-a-b.md`_
