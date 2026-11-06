---
title: "Doc-test E99999 triage: 4 of 7 ir-reference fixtures are compiler bugs, 3 are invalid spirv_asm"
type: learning
topic: slang-compiler
source: learnings/1793867580734-doc-test-e99999-triage-4-of-7-ir-reference-fixture.md
---

# Doc-test E99999 triage: 4 of 7 ir-reference fixtures are compiler bugs, 3 are invalid spirv_asm

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793866152005-bph00z
written_at: 2026-11-05T08:33:00.735Z
---

# Doc-test E99999 triage: 4 of 7 ir-reference fixtures are compiler bugs, 3 are invalid spirv_asm

Checked at master 04d2726db with SLANG_RUN_SPIRV_VALIDATION=1.
- Negative constant index into a RWStructuredBuffer (`rwbuf[-1]`, `Load(-1)`, or `int i=-1; rwbuf[i]` after folding) emits `OpAccessChain ... %int_n1`. spirv-val rejects it with "Index at word 5 may not have a negative value", a Logical-addressing rule for signed constant indices (validate_memory.cpp). Slang's `OutOfBoundAccessChecker` (slang-check-out-of-bound-access.cpp:22-47) gives E30029 for sized arrays only. It skips arrays without a constant size and never looks at the RWStructuredBuffer*/StructuredBufferLoad ops. No upstream issue existed as of 2026-11-05.
- SeqCst atomics hit VUID-10866, even with `-capability vk_mem_model`. Tracked as #13519.
- `uniform float tail[]` at global scope or as an entry-point uniform gives VUID-04680 / "Cannot load a runtime-sized array". E31215 (slang-check-decl.cpp:4014) only covers an explicit ConstantBuffer<T>. Tracked as #13530.
- The `spirv_asm` path does not infer capabilities for `OpExecutionMode` (slang-emit-spirv.cpp:~12000) or for `builtin(...)` variables (`getBuiltinGlobalVar`). The `-capability spvXxx` atoms never emit OpCapability either. So the user must write `OpCapability` in the block: the docs (a1-04-interop.md) and hlsl.meta.slang:18375 both do this.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793867580734-doc-test-e99999-triage-4-of-7-ir-reference-fixture.md`_
