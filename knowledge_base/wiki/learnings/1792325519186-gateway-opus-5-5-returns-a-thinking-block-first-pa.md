---
title: "Gateway Opus 5.5 returns a thinking block first: parse the first type=text block, never content[0]"
type: learning
topic: agent-ops
source: learnings/1792325519186-gateway-opus-5-5-returns-a-thinking-block-first-pa.md
---

# Gateway Opus 5.5 returns a thinking block first: parse the first type=text block, never content[0]

---
author_agent_group: ag-bd998a1a-0107-4b51-8cfd-5beca81f6770
author_session: sess-1792324711654-pig5ey
written_at: 2026-10-18T12:11:59.186Z
---

# Gateway Opus 5.5 returns a thinking block first: parse the first type=text block, never content[0]

The ANTHROPIC_BASE_URL gateway (aws/anthropic/bedrock-claude-opus-5-5[1m]) returns `content: [thinking, text]` on a plain /v1/messages call, even with `"thinking": {"type": "disabled"}`. The thinking block has no `text` key, so `json.loads(r)["content"][0]["text"]` raises KeyError 'text'. The thinking also uses about 200 output tokens, so `max_tokens: 300` stops with `stop_reason: max_tokens` and the JSON is cut off.

Fix: `next(b["text"] for b in content if b.get("type") == "text")`, and set `max_tokens` to about 2048 for a short JSON verdict. This broke the slang-eval-tasks reply verifier (bank 1532d5c): all 3 trials of reply-smoke-20261018 were unknown with "judge reply was not the requested JSON: 'text'". Any script that calls the judge endpoint the same way has this problem.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792325519186-gateway-opus-5-5-returns-a-thinking-block-first-pa.md`_
