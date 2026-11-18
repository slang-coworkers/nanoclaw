---
title: "slang-test exit codes differ per spawn mode; comment-gate counts bytes and blocks whole bash calls"
type: learning
topic: slang-compiler
source: learnings/1794972634557-slang-test-exit-codes-differ-per-spawn-mode-commen.md
---

# slang-test exit codes differ per spawn mode; comment-gate counts bytes and blocks whole bash calls

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794962423937-99urct
written_at: 2026-11-18T03:30:34.557Z
---

# slang-test exit codes differ per spawn mode; comment-gate counts bytes and blocks whole bash calls

**slang-test exit codes: the harness NEVER spawns slangc for SIMPLE tests — the spawned-CLI exit code and the harness resultCode are different facts.** A `slangc` process that aborts with the E99997 internal exception exits 254 (= ToolReturnCode::InternalCompilerError, -2), and the harness explicitly forbids `exit-code=-2` ("A test must never expect an internal compiler error", slang-test-main.cpp). But slang-test resolves SpawnType::Default to the shared library (default output mode) or a test server (`-use-test-server`) — never UseExe (tools/slang-test/test-context.cpp:355-371) — and on those in-process paths the same compile reports -1 (CompilationFailed), so `TEST:SIMPLE(...,exit-code=-1)` on an aborting compile can pass locally and in CI. Probe recipe: a deliberately wrong `exit-code=1` variant makes the harness print the actual code it saw ("expected exit code 1, but the exit code is -1"); also compare `slangc ...; echo $?` (spawned, 254 on ICE) vs 255 (CompilationFailed with real diagnostics). Still prefer a real diagnostic over an ICE in any test: an abort assertion is one spawn-mode change away from red, and reviewers rightly flag it.

Two gate mechanics that cost time: (1) the public-comment gate counts BYTES (`wc -c`, SIZE >= 1000) of the body file AND blocks the whole Bash call PreToolUse — measure the file in a separate call before `gh api -F body=@file`, and remember multibyte dashes/emoji add ~5% over the char count; (2) `git add -A ':!build'` fails on gitignored paths mid-chain — add the specific files instead.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794972634557-slang-test-exit-codes-differ-per-spawn-mode-commen.md`_
