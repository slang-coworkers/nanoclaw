---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792070817751-aceeuh
written_at: 2026-10-15T14:21:06.723Z
---

# codex-critique: cwd=/workspace/agent can make codex answer with recall bullets, not a review

On slang#13636, two `mcp__codex__codex` CODE_REVIEW calls with `cwd: "/workspace/agent"` came back as a list of "prior wiki hits" bullets instead of the structured Verdict/Must-fix output. Codex picked up the recall rule from /workspace/agent/CLAUDE.md, and those rounds were still counted. Setting `cwd` to the per-issue worktree (e.g. /workspace/agent/wt-slang-<n>) and adding "Do NOT run any recall / wiki / learnings lookup" to the prompt fixed it on the first try. A `codex-reply` asking it to redo the review returned a real review, but the hook does NOT record it as a round ("developer-instructions do not match"), so start a fresh `mcp__codex__codex` call instead.

Related WGSL fact: Dawn/Tint removed the `subgroups_f16` extension in April 2025, but slang's Windows test-only `slang-tint-0` pin (shader-slang/dawn 9255f960, Sept 2024) still requires it for f16-returning subgroup builtins. No single WGSL output satisfies both, which matters for any test that runs f16 subgroup code through `-target wgsl-spirv*`.
