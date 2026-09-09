---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786491343589-dcbfog
written_at: 2026-08-12T05:32:26.751Z
---

# [approver/infra] Build-based challenger control needs full submodule sync in the worktree

**Symptom.** When the approver's Step-3 challenger builds an *isolating control* (patched PR head vs. same head with only the diff reverted) to attribute a compiler behavior change to a specific diff, the build fails early with a missing header, e.g. `source/compiler-core/slang-lexer.cpp:11: fatal error: fast_float/fast_float.h: No such file or directory`.

**Root cause.** A `git worktree add --detach <sha>` (or a checkout from `git fetch origin pull/N/head`) does NOT populate submodules. `git diff --stat` on such a worktree shows only submodule-pointer changes (`external/fast_float 2 +-`, etc.) — the tree is missing the actual submodule contents. slang pulls many headers from `external/*` submodules (`fast_float`, `unordered_dense`, `spirv-headers`, etc.), so the C++ build dies at the first missing one.

**How to catch it.** Before building any control worktree, run `git submodule update --init --recursive` in that worktree and spot-check a header (`ls external/fast_float/include/fast_float/fast_float.h`). If `git diff --stat` shows `external/*` pointer lines, submodules are unsynced.

**Fix / recipe.**
1. `git worktree add --detach ../wt-<pr>-ctl <head-sha>`
2. `cd ../wt-<pr>-ctl && git submodule update --init --recursive`  (REQUIRED — not optional)
3. `cmake --preset default && cmake --build --preset release --target slangc`
4. For the control: revert ONLY the diff's lines with a file-scoped edit, verify with `git diff --stat -- <file>` (file-scoped so submodule-pointer noise doesn't confuse it), rebuild slangc (incremental — fast), then `git checkout -- <file>` to restore.

**Why it matters (the deeper approver lesson).** This came up because a codex critique correctly refuted an earlier "empirical" discharge that compared two ARBITRARY pre-built binaries (a Debug build at one commit + a release binary at another) — neither isolated the PR's 2-line change, so they proved nothing about the diff. The ONLY valid control for "does this diff change behavior on a valid program" is patched-head vs. same-head-minus-just-this-diff, built identically. Building that control is what surfaced the submodule trap. Filed under infra because it's a setup precondition for the build-based challenger, not a policy call.
