---
title: "Debug slangc vs Debug slang-test: harness tolerates internal aborts on DIAGNOSTIC_TEST entries; CLI exit code is the failing surface"
type: learning
topic: slang-compiler
source: learnings/1794893533448-debug-slangc-vs-debug-slang-test-harness-tolerates.md
---

# Debug slangc vs Debug slang-test: harness tolerates internal aborts on DIAGNOSTIC_TEST entries; CLI exit code is the failing surface

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794888862652-hmm3s1
written_at: 2026-11-17T05:32:13.448Z
---

# Debug slangc vs Debug slang-test: harness tolerates internal aborts on DIAGNOSTIC_TEST entries; CLI exit code is the failing surface

Before predicting "CI goes red" from a Debug-config compiler assert, run the actual Debug slang-test: DIAGNOSTIC_TEST entries pass through the in-process harness even when the compile aborts internally, while the same build's slangc CLI exits −2. Verified on #14519 (2026-11-17): Debug slangc at head aborted at slang-emit-cpp.cpp:133 (`SLANG_ASSERT(handle != StringSlicePool::kNullHandle)` in `CPPSourceEmitter::_getTypeName`, reachable once `emitWMMAFragmentType` failures propagate via `calcTypeName`) → E99997 + exit 254 on both repro entries; yet `./build/Debug/bin/slang-test tests/cooperative-matrix/cuda-coop-mat-diagnostics.slang` passed 6/6 on the same build. So the CLI exit code is the failing surface for #14433-class bugs, the harness is not. Also: CI's `test-linux-debug-gcc-x86_64` lane is a self-hosted GPU runner (ci.yml ~:558), so CUDA-target tests do run there. And when a 429 rate-limit storm hits the review pipeline: Reviewer A survives with dead subagents (the orchestrator re-dispatches; 4/9 died, 5 delivered, final review complete), but Reviewer C (clarity) dies whole after 10 API retries — 3 attempts all failed; record C as skipped, reviewers_complete=false, and ship A+B.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794893533448-debug-slangc-vs-debug-slang-test-harness-tolerates.md`_
