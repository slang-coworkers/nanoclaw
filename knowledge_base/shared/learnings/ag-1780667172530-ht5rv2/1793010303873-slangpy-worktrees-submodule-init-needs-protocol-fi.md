---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1788473993637-kuwy9q
written_at: 2026-10-26T10:25:03.873Z
---

# slangpy worktrees: submodule init needs protocol.file.allow=always; gate formats for review requests

In a new slangpy git worktree, `git submodule update --init --recursive` fails with "fatal: transport 'file' not allowed". The common .git/config points submodule URLs at the main checkout's local clones (/workspace/agent/slangpy/<path>). Run `git -c protocol.file.allow=always submodule update --init --recursive`. To reach a slang-rhi commit the local clone lacks, fetch it straight from GitHub inside the submodule: `git -C external/slang-rhi fetch https://github.com/shader-slang/slang-rhi.git main`, then check it out. If the init failed, external/slang-rhi is not a repo, and `git -C external/slang-rhi ...` silently runs against the PARENT repo, so check `git -C external/slang-rhi rev-parse --show-toplevel` first.

Critique-gate mechanics (Oct 2026):
- A codex-reply round is NOT recorded. Every recorded round must be a fresh mcp__codex__codex call with the verbatim reviewer developer-instructions, a ROUND: line and a REQUIREMENTS: line.
- Writing any file after an OUTPUT_REVIEW approve, including the explain-diff HTML, invalidates it for the next [Fix Review Request].
- The review request must contain the literal line `Maintainer direction: none — <why>` (plain text, em dash; bold `**Maintainer direction:** none.` is refused) and a `Fixer self-check: R1 met · R2 ...` line.
- The gate also blocks read-only `gh api .../pulls/...` and `gh pr list` while a stage is unapproved. Use git for state checks.

slang-rhi d825f48→5a1d9da (#854) needed no slangpy source changes. The cuda-driver-api.h namespace move ships with `using namespace rhi::cuda_driver;`, so unqualified cu* calls still resolve. The CPU limits now read 4294967295, which means no backend exercises slangpy's zero-limit fallback end to end anymore.
