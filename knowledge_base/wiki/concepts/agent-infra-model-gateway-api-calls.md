---
title: "Calling the model gateway from scripts: parse the text block by type and budget tokens for thinking"
type: concept
group: agent-infra
tags: [model-gateway, anthropic-api, opus, thinking, max-tokens, llm-judge, verifier, response-parsing]
source_count: 2
---

# Calling the model gateway from scripts: parse the text block by type and budget tokens for thinking

## TL;DR

- The `ANTHROPIC_BASE_URL` gateway's Opus model returns `content: [thinking, text]` on a plain `/v1/messages` call, even with `"thinking": {"type": "disabled"}`.
- Since 2026-11-16 the OneCLI gateway enforces an `open-models-only` policy that 403-blocks Anthropic models on POST /v1/messages; use `nvidia/`-prefixed open model ids (e.g. `nvidia/zai-org/glm-5.3`) instead.
- Never read `content[0]["text"]`. Select the first block whose `type` is `text`: `next(b["text"] for b in content if b.get("type") == "text")`.
- The thinking block uses output tokens too, about 200 of them. A small `max_tokens` (e.g. 300) ends with `stop_reason: max_tokens` and cuts the answer off. Use about 2048 even for a short JSON verdict.
- Check `stop_reason` before parsing. A cut-off reply looks like "the model did not return JSON", which is a different fault.
- Any script that calls the judge endpoint this way (verifiers, scorers, one-off classifiers) has the same defect. Fix the shared helper, not one caller.

## The response shape

Scripts that call the model gateway directly, instead of through the agent SDK, usually assume the reply's first content block is the answer. On the gateway model observed at the time (`aws/anthropic/bedrock-claude-opus-5-5[1m]`) that is false. A plain `/v1/messages` request returns a `thinking` block first and the `text` block second, and it does so even when the request sets `"thinking": {"type": "disabled"}`. The thinking block has no `text` key, so `json.loads(r)["content"][0]["text"]` raises `KeyError: 'text'`.

Since 2026-11-16 that Anthropic model is itself unavailable through the gateway: the OneCLI proxy enforces an `open-models-only` policy rule that returns `403 Blocked by OneCLI policy rule "open-models-only"` for Anthropic models on POST /v1/messages (seen on slang#14497). What still works through `ANTHROPIC_BASE_URL=https://inference-api.nvidia.com`: GET /v1/models (lists the allowed open models), POST /v1/messages and POST /v1/chat/completions with an open model id that carries the `nvidia/` prefix — the unprefixed `zai-org/glm-5.3` is policy-blocked while `nvidia/zai-org/glm-5.3` succeeds on the same Anthropic-format endpoint. For claude-CLI-based runners (slang-pr-review-runner, slang-clarity-review-runner), re-dispatch once with `--model nvidia/zai-org/glm-5.3` and export `ANTHROPIC_DEFAULT_OPUS_MODEL` / `_SONNET_` / `_HAIKU_` / `ANTHROPIC_FALLBACK_MODEL` to the same id, since the CLI's haiku/sonnet defaults also point at blocked Anthropic models. This breaks production model-equivalence, so record the deviation in the report header and flag the policy to the operator ([open-models-only policy blocks Opus; nvidia-prefixed models work](../learnings/1794822190481-onecli-open-models-only-policy-blocks-opus-nvidia-.md)).

The thinking also spends output tokens, about 200 in the observed case. With `max_tokens: 300` the reply stopped with `stop_reason: max_tokens`, and the JSON in the text block was cut off. So there are two failures with one cause: the parser reads the wrong block, and the budget meant for the answer is partly spent before the answer starts.

The fix is to select the block by type (`next(b["text"] for b in content if b.get("type") == "text")`) and set `max_tokens` to about 2048 for a short JSON verdict. This broke the slang-eval-tasks reply verifier at bank `1532d5c`: all 3 trials of `reply-smoke-20261018` scored unknown with "judge reply was not the requested JSON: 'text'". The error text named a JSON problem, but the real fault was the positional index ([gateway Opus 5.5 returns a thinking block first](../learnings/1792325519186-gateway-opus-5-5-returns-a-thinking-block-first-pa.md)).

**Source learnings (2):**
- [Gateway Opus 5.5 returns a thinking block first: parse the first type=text block, never content[0]](../learnings/1792325519186-gateway-opus-5-5-returns-a-thinking-block-first-pa.md) — `content: [thinking, text]` even with thinking disabled; KeyError 'text'; `max_tokens: 300` truncates; use ~2048
- [Open-models-only policy blocks Anthropic gateway models](../learnings/1794822190481-onecli-open-models-only-policy-blocks-opus-nvidia-.md)

_Catalog: [[wiki/index.md]]_
