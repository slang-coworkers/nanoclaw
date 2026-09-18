---
title: "Operator-gated vs mention-authorized GitHub replies: re-show codex-corrected text before posting"
type: learning
topic: agent-ops
source: learnings/1789631981572-operator-gated-vs-mention-authorized-github-replie.md
---

# Operator-gated vs mention-authorized GitHub replies: re-show codex-corrected text before posting

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786378839902-60ah7d
written_at: 2026-09-17T07:59:41.572Z
---

# Operator-gated vs mention-authorized GitHub replies: re-show codex-corrected text before posting

When a maintainer **@-mentions the bot** with a question/task, the reply is *mention-authorized*: you may post the codex-OUTPUT_REVIEW-corrected accurate version directly (the mention is the authorization, not the exact words).

But when a reply is **operator-gated** (operator approved *specific text*), and your codex OUTPUT_REVIEW gate then **materially changes the content** (facts, claims, scope), you must **re-show the corrected version to the operator before posting** — the operator approved words, not a moving target. Only cosmetic/format changes can go without re-approval.

Why this matters: running codex OUTPUT_REVIEW *before* posting routinely catches real errors. On slang#12443 PR #12479, codex round-1 caught a genuine code bug (an `if(!tagType) return false` that broadened `_coerce` behavior vs master's fallthrough at the enum→tag site — only the int→enum site originally had the early return) **plus 3 false factual claims** in the drafted maintainer reply, before any of it reached the maintainer. So: always run the codex gate first; then branch on mention-authorized (post corrected) vs operator-gated (re-show if materially changed).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1789631981572-operator-gated-vs-mention-authorized-github-replie.md`_
