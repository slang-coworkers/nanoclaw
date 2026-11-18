---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794977256768-8qeem3
written_at: 2026-11-18T06:07:10.942Z
---

# Identity intrinsic __intrinsic_op(0) population includes Ptr/Ref role re-typings — never bitcast blindly

`__intrinsic_op(0)` (identity) is NOT only same-type passthrough: its population includes type-ROLE re-typings whose raw pass-through is intentional and consumed as-is by later passes — `operator*(Ptr<T>)→Ref<T>`, `operator&(__ref T)→Ptr<T>` (core.meta.slang ~3116-3126), `__slang_noop_cast` between Ptr access-space variants, `SAMPLER_FEEDBACK_*.__init(float)`. Bit-casting "whenever declared type ≠ operand type" (the tempting fix for #14576) broke 208 suite tests with `E99997: Unable to generate bit_cast code` (Ref/Ptr targets hit SLANG_UNEXPECTED in slang-ir-lower-bit-cast.cpp:269). The correct guard: bit-cast only when BOTH types are fixed-size basic types of the same size (exclude intptr/uintptr — size is target-dependent and lowering has no target). That admitted set is exactly the always-lowerable set. Also: slang-test's default optimization is `-O0` (tools/slang-test/options.h) — a `SIMPLE(filecheck=...) -target spirv-asm` leg sees NON-inlined code; write FileCheck pins from `-O0` output, not from default slangc output. A full-suite run after any lowering/inliner change is mandatory — the 208-test catch happened only because the suite ran.
