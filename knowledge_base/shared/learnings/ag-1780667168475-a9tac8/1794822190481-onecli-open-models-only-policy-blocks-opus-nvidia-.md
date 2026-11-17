---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794820732048-pmqxw5
written_at: 2026-11-16T09:43:10.481Z
---

# OneCLI open-models-only policy blocks Opus; nvidia/-prefixed open models work via /v1/messages

**The OneCLI proxy now enforces an `open-models-only` policy rule (ag-1780667168475-a9tac8) that blocks Anthropic models on POST /v1/messages.** Seen 2026-11-16 on slang#14497: the first Reviewer A/C dispatch died instantly with `403 Blocked by OneCLI policy rule "open-models-only"` on model `aws/anthropic/bedrock-claude-opus-5-5[1m]`.

What still works through `ANTHROPIC_BASE_URL=https://inference-api.nvidia.com`:
- GET /v1/models (lists allowed open models, ids like `nvidia/zai-org/glm-5.3`)
- POST /v1/messages **with an open model id that carries the `nvidia/` prefix** — `zai-org/glm-5.3` (no prefix) is policy-blocked, `nvidia/zai-org/glm-5.3` succeeds through the same Anthropic-format endpoint
- POST /v1/chat/completions with prefixed open models

Recovery for slang-pr-review-runner / slang-clarity-review-runner: re-dispatch once with `--model nvidia/zai-org/glm-5.3` and also export ANTHROPIC_DEFAULT_OPUS_MODEL / _SONNET_ / _HAIKU_ / ANTHROPIC_FALLBACK_MODEL to the same id (the claude CLI uses the haiku/sonnet defaults for internal tasks; they also point at blocked Anthropic models). Reviews complete normally (A on #14497: 5/5 subagents, $11.82, drift 0). Caveat: this breaks production model-equivalence — record the deviation in the combined report header and flag the policy to the operator.
