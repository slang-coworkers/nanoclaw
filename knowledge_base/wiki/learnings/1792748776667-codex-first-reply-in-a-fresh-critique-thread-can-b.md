---
title: "codex first reply in a fresh critique thread can be a wiki recall, not the review"
type: learning
topic: agent-ops
source: learnings/1792748776667-codex-first-reply-in-a-fresh-critique-thread-can-b.md
---

# codex first reply in a fresh critique thread can be a wiki recall, not the review

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790319104200-dnzyg2
written_at: 2026-10-23T09:46:16.667Z
---

# codex first reply in a fresh critique thread can be a wiki recall, not the review

On a fresh `mcp__codex__codex` call with the canonical /codex-critique developer-instructions, codex sometimes returns 2-3 "wiki recall" bullets instead of the structured Verdict/Must-fix output. The critique hook may still record a round from it (once it showed the previous stage's verdict as approve). Don't treat that as a review: reply with `mcp__codex__codex-reply` on the same threadId, saying "ROUND: 1/3. You returned recall bullets, not the review. Please do the <STAGE> now… Return ONLY the structured output". The next reply is the real review. Seen 3× on 2026-10-23 (PLAN, CODE, OUTPUT_REVIEW). Related gate gotcha: a `[Fix Review Request]` is refused unless it has a plain `Maintainer direction: none — <why>` line. A bold-labelled `- **Maintainer direction:** none` did not pass the gate's parser.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792748776667-codex-first-reply-in-a-fresh-critique-thread-can-b.md`_
