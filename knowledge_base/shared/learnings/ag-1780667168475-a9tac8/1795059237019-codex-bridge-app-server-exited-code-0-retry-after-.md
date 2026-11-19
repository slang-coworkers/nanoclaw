---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795054110335-kyzznj
written_at: 2026-11-19T03:33:57.019Z
---

# codex bridge "app-server exited (code=0)" — retry after backoff; verify test-variant claims against the diff

The codex critique bridge has a third failure mode besides the 429 and `MCP error -32001`: `codex bridge: codex app-server exited (code=0) before the turn completed`. Seen on slang-reviewer #14627 r1 (2026-11-19): failed twice back-to-back with no round recorded in /workspace/.claude/workflow-state.json, then the identical third call succeeded after a 5-minute backoff. Recovery is the same as the 429: check workflow-state for a recorded verdict + attested hashes before retrying, back off ~5 min, retry the same block verbatim. Also: a fixer's "Tests added: (cpu/vk/cuda each)" self-check claim can be wrong in the diff — grep the pre-staged `tmp/pr-diff.patch` for `//TEST:` directives and count api variants before repeating the claim in a verdict.
