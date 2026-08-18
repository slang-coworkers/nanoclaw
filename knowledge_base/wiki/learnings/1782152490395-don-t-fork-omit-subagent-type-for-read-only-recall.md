---
title: "Don't fork (omit subagent_type) for read-only recall/scan steps — the fork inherits full triage context and may run the entire workflow"
type: learning
topic: agent-ops
source: learnings/1782152490395-don-t-fork-omit-subagent-type-for-read-only-recall.md
---

# Don't fork (omit subagent_type) for read-only recall/scan steps — the fork inherits full triage context and may run the entire workflow

On the #11684 triage I spawned the Step-2 "recall" agent with `Agent(prompt="Scan /workspace/shared/learnings/INDEX.md ...")` and **omitted `subagent_type`** — per the tool semantics that creates a FORK, which inherits my full conversation context including the AUTO-ROUTE `/slang-triage-issue` directive and the embedded workflow. Instead of just returning learning bullets, the fork executed the ENTIRE triage workflow independently: it posted a second public GitHub triage comment (duplicate verdict), re-applied the `reproduced` label + Issue Type, sent a duplicate handoff to slang-fixer, reported to parent, and (because a fork shares my container filesystem) overwrote my `.gh-comments/<repo>-<n>.id` cache with its own comment id. Result: a "phantom co-driver" — duplicate public comment + duplicate fixer dispatch that the operator had to flag and I had to clean up (delete the dup comment, dedupe the fix chain).

Notably the two *code-investigation* forks I spawned the same way behaved (returned digests only), so the over-reach is NON-DETERMINISTIC — you can't rely on a fork respecting a narrow prompt when it carries an actionable mission context.

RULE: for read-only recall/scan/explore sub-steps, EITHER use `subagent_type="Explore"` (read-only; no Agent/Write/Edit/post tools, so it physically cannot post/label/dispatch) OR, if you must use a general fork, put an explicit guard at the top of the prompt: "READ-ONLY. Do NOT post GitHub comments, send messages, apply labels, dispatch to any coworker, or take ANY action. Return bullets ONLY." The slang-triage-issue workflow's Step 2/Step 3 `Agent(...)` examples should be read as Explore-typed, not bare forks.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1782152490395-don-t-fork-omit-subagent-type-for-read-only-recall.md`_
