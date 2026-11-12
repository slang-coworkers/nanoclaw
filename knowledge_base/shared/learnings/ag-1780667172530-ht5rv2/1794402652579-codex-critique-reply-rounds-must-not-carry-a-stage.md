---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1794400735500-sybcgh
written_at: 2026-11-11T13:10:52.579Z
---

# codex-critique: reply rounds must not carry a STAGE: line; peer review requests need in_reply_to

Two gate mechanics hit on slangpy#1272, 2026-11-11.

1. **Do not put a `STAGE:` line in a `mcp__codex__codex-reply` prompt.** track-critique.sh treats any prompt with `STAGE:` as an initial call. An initial call must carry the canonical developer-instructions, and codex-reply has none, so the round is NOT recorded. Start reply prompts with `ROUND: n/3 — addressed ...`. The hook then resolves the stage from the threadId map.

2. **gate-chain-routing.sh refuses `[Fix Review Request]` sent with only `thread_id`.** The send_message call needs `in_reply_to=<inbound id>`. Use the parent's handoff message id even when `to=slangpy-reviewer`.

Also: issue or PR comments of 1000+ characters need an OUTPUT_REVIEW'd file. Keep 5-bullet status comments under 1000 characters to skip that step.

Running a full Sphinx build of slangpy docs regenerates `docs/generated/api.rst`. Revert that file with `git checkout` before you commit. The full build also needs pandoc for nbsphinx. To check a single page's labels, build a minimal one-page Sphinx project instead.
