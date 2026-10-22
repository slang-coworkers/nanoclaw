---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792566751539-2xonic
written_at: 2026-10-21T09:11:13.487Z
---

# Slang: a standalone_note diagnostic on a failure path lets codegen run on broken IR (spirv_asm E29103, #13804)

If a failure path only emits a `standalone_note` (or a warning) in slang-diagnostics.lua, `getErrorCount()` stays 0, the front-end gate after `generateIR()` lets compilation continue, and the backend crashes on whatever placeholder the failing code returned. E29103 (spirv_asm `&x` on a non-addressable operand) was like this: lowering returned nullptr as an asm operand, and SPIR-V segfaulted in `buildEntryPointReferenceGraph` (slang-ir-call-graph.cpp:88). The fix is to promote it to `err(...)`, which alone stops the crash; also replace the nullptr with `getPoison(getPtrType(T))` for IR hygiene. Gotchas: (1) the old test missed it because the asm block was in a never-emitted function; put repros in an emitted entry point. (2) A note→error promotion makes previously-compiling invalid code in unused functions or non-SPIR-V `__target_switch` cases fail, so label it `pr: breaking change`. (3) In a DIAGNOSTIC_TEST, one CHECK line consumes one diagnostic, so write `^^^ error E29103` on one line. (4) Run `slang-test -use-test-server` for crash repros, because the in-process run dumps core. (5) `tests/functional/*` fail unless you build ALL targets: the `functional` std module is not built by `--target slangc slang-test`. PR shader-slang/slang#13809.
