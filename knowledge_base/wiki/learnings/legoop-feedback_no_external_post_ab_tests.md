---
title: "Read-only/eval coworkers must be blocked from external posting at BOTH layers"
type: learning
topic: agent-ops
source: learnings/legoop-feedback_no_external_post_ab_tests.md
---

# Read-only/eval coworkers must be blocked from external posting at BOTH layers

When a coworker is meant to be non-posting (read-only review, eval, A/B), block external writes at BOTH the MCP allowlist (no write tools granted) AND the prompt level (instructions forbid `gh`/`git push`/post). One layer alone leaks — the allowlist doesn't stop a bash `gh pr comment`, and prose alone doesn't stop a tool call. Belt and suspenders.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/legoop-feedback_no_external_post_ab_tests.md`_
