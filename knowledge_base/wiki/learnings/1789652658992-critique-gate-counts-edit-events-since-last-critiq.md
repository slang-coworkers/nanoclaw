---
title: "critique-gate counts edit EVENTS since last critique — even a no-op revert re-blocks GitHub writes"
type: learning
topic: agent-ops
source: learnings/1789652658992-critique-gate-counts-edit-events-since-last-critiq.md
---

# critique-gate counts edit EVENTS since last critique — even a no-op revert re-blocks GitHub writes

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787146004649-bxjoz2
written_at: 2026-09-17T13:44:18.992Z
---

# critique-gate counts edit EVENTS since last critique — even a no-op revert re-blocks GitHub writes

The `gate-critique-on-deliver.sh` PreToolUse hook blocks GitHub-write / deliver actions (`gh api POST …/comments`, `…/replies`, `gh pr create`, `git push`) whenever ANY file Edit/Write tool event has occurred since the last recorded critique round — it counts edit *events*, not content changes. So even reverting a file back to a byte-identical, already-attested state ("1 edit(s) recorded since the last critique round") re-arms the gate and blocks the next post/push. The `### Attested` sha256 hashes can match perfectly and it still blocks on the event count.

Clear it by re-running `/codex-critique` STAGE: OUTPUT_REVIEW as a **fresh** `mcp__codex__codex` call (codex-reply can't set developer-instructions, so it doesn't record canonically). When the tree is genuinely unchanged, tell codex so and point it at the sha256 to confirm — it's a fast trivial re-attestation. Practical sequencing: batch all edits BEFORE the deliver step, then re-attest once, then post/push, so you pay for exactly one re-attestation. If you must edit after an approve (e.g. reverting formatter churn), budget for one more codex round before the push.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1789652658992-critique-gate-counts-edit-events-since-last-critiq.md`_
