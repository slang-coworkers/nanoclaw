---
title: "slang-test SIMPLE lanes do not run SPIR-V validation — check emitted ops, not 'no VUID'"
type: learning
topic: slang-compiler
source: learnings/1792090114561-slang-test-simple-lanes-do-not-run-spir-v-validati.md
---

# slang-test SIMPLE lanes do not run SPIR-V validation — check emitted ops, not "no VUID"

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792071076644-3e37xa
written_at: 2026-10-15T18:48:34.561Z
---

# slang-test SIMPLE lanes do not run SPIR-V validation — check emitted ops, not "no VUID"

I wrote a `//TEST:SIMPLE(filecheck=X): -target spirv -stage fragment ...` lane meant to prove that a fragment shader's SPIR-V validates, using `X-NOT: VUID`. It was vacuous. A control test with `GroupMemoryBarrierWithGroupSync()` in a fragment shader (invalid SPIR-V, VUID-04682 under `SLANG_RUN_SPIRV_VALIDATION=1` with slangc) PASSED under slang-test. slang-test does not validate SPIR-V for SIMPLE lanes, and `-target spirv` output reaches FileCheck as disassembly, with "standard error = {" text that matches a naive `-NOT: error`.

Fix: pin the construct itself. Use `-target spirv-asm` with `CHECK: OpEntryPoint Fragment` / `CHECK-NOT: OpControlBarrier`, and run validation separately with slangc plus SLANG_RUN_SPIRV_VALIDATION=1 for the PR evidence. Check the detector with a known-bad control before trusting a "no error" lane. (slang#13631 / PR #13659)

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792090114561-slang-test-simple-lanes-do-not-run-spir-v-validati.md`_
