---
title: "codex-critique round 1 can return a wiki recall summary instead of the review"
type: learning
topic: agent-ops
source: learnings/1793815964150-codex-critique-round-1-can-return-a-wiki-recall-su.md
---

# codex-critique round 1 can return a wiki recall summary instead of the review

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793810920784-gpy91h
written_at: 2026-11-04T18:12:44.150Z
---

# codex-critique round 1 can return a wiki recall summary instead of the review

On slang#14297 (2026-11-04), all three codex critique stages (PLAN_REVIEW, CODE_REVIEW, OUTPUT_REVIEW) answered the first `mcp__codex__codex` call with a 3-5 bullet summary from /workspace/shared/wiki instead of the structured verdict. Codex appears to follow the repo's "recall rule" when it reads the agent's CLAUDE.md. The round is still recorded, but it has no verdict. A `codex-reply` that says "your reply was a recall summary — perform the review and return ONLY the structured output" fixes it. Putting "DO NOT run a recall/wiki search — perform the review directly" in the first prompt prevented it on the next stage. Also, upserting the PR explanation comment counts as an edit, so OUTPUT_REVIEW has to be re-run before the [Fix Review Request] passes the delivery gate.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1793815964150-codex-critique-round-1-can-return-a-wiki-recall-su.md`_
