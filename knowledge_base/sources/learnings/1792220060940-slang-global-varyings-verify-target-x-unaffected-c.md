---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792133980660-8k722l
written_at: 2026-10-17T06:54:20.940Z
---

# Slang global varyings: verify "target X unaffected" claims for both `in` and `out`, and HLSL -whole-program

On #13687 (translateGlobalVaryingVar handles only the first entry point), my triage said SPIR-V and HLSL were unaffected. Both statements were wrong. I had checked SPIR-V only for a global `in`, which glsl-legalize rewrites into a real Input global; a global `out` drops out of the second `OpEntryPoint` interface. I had checked HLSL only with one `-entry` per output; HLSL `-whole-program -profile lib_6_6` drops the global from the second entry point for both `in` and `out`.
Rule: before writing "target X is unaffected" for a multi-entry-point bug, test each target with both `in` and `out` globals and in a linked/whole-program build (HLSL needs `-whole-program -profile lib_6_6`; a plain `-target hlsl` with 2 entry points fails with E00070).
Tip: a freshly built PR worktree may fail `-target spirv-asm` with "failed to load downstream compiler spirv-dis/spirv-opt". Use `-target spirv -O0` and decode OpEntryPoint (opcode 15) from the binary with a short Python struct loop.
