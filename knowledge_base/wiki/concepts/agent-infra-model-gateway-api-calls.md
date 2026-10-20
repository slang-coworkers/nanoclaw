---
title: "Calling the model gateway from scripts: parse the text block by type and budget tokens for thinking"
type: concept
group: agent-infra
tags: [model-gateway, anthropic-api, opus, thinking, max-tokens, llm-judge, verifier, response-parsing]
source_count: 1
---

# Calling the model gateway from scripts: parse the text block by type and budget tokens for thinking

## TL;DR

- The `ANTHROPIC_BASE_URL` gateway's Opus model returns `content: [thinking, text]` on a plain `/v1/messages` call, even with `"thinking": {"type": "disabled"}`.
- Never read `content[0]["text"]`. Select the first block whose `type` is `text`: `next(b["text"] for b in content if b.get("type") == "text")`.
- The thinking block uses output tokens too, about 200 of them. A small `max_tokens` (e.g. 300) ends with `stop_reason: max_tokens` and cuts the answer off. Use about 2048 even for a short JSON verdict.
- Check `stop_reason` before parsing. A cut-off reply looks like "the model did not return JSON", which is a different fault.
- Any script that calls the judge endpoint this way (verifiers, scorers, one-off classifiers) has the same defect. Fix the shared helper, not one caller.

## The response shape

Scripts that call the model gateway directly, instead of through the agent SDK, usually assume the reply's first content block is the answer. On the current gateway model (`aws/anthropic/bedrock-claude-opus-5-5[1m]`) that is false. A plain `/v1/messages` request returns a `thinking` block first and the `text` block second, and it does so even when the request sets `"thinking": {"type": "disabled"}`. The thinking block has no `text` key, so `json.loads(r)["content"][0]["text"]` raises `KeyError: 'text'`.

The thinking also spends output tokens, about 200 in the observed case. With `max_tokens: 300` the reply stopped with `stop_reason: max_tokens`, and the JSON in the text block was cut off. So there are two failures with one cause: the parser reads the wrong block, and the budget meant for the answer is partly spent before the answer starts.

The fix is to select the block by type (`next(b["text"] for b in content if b.get("type") == "text")`) and set `max_tokens` to about 2048 for a short JSON verdict. This broke the slang-eval-tasks reply verifier at bank `1532d5c`: all 3 trials of `reply-smoke-20261018` scored unknown with "judge reply was not the requested JSON: 'text'". The error text named a JSON problem, but the real fault was the positional index ([gateway Opus 5.5 returns a thinking block first](../learnings/1792325519186-gateway-opus-5-5-returns-a-thinking-block-first-pa.md)).

**Source learnings (1):**
- [Gateway Opus 5.5 returns a thinking block first: parse the first type=text block, never content[0]](../learnings/1792325519186-gateway-opus-5-5-returns-a-thinking-block-first-pa.md) — `content: [thinking, text]` even with thinking disabled; KeyError 'text'; `max_tokens: 300` truncates; use ~2048

_Catalog: [[wiki/index.md]]_
