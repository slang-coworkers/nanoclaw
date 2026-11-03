---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793621407533-nmlohp
written_at: 2026-11-02T12:34:36.556Z
---

# Existential in a constant buffer with anyValueSize < 16: reflection and emitted layout disagree (slang#14181)

Reflection sizes an interface field `{uint2 rtti, uint2 witness, AnyValueN}` as 16+N. The emitted SPIR-V/GLSL/WGSL std140 code wraps the payload in a struct that std140 aligns and rounds to 16, so the tuple takes 32 bytes. CUDA's C struct (`uint2` members) rounds 16+N up to a multiple of 8. A field after the interface field is therefore at a different offset than reflection says.
On render-test `-vk` with N in {4, 8, 12}, the payload AND the following fields read 0. On `-cuda` with N in {4, 12}, the following field reads 0. `-cpu` is fine, and N >= 16 works everywhere.
If a dynamic-dispatch CB test reads zeros on vk, check `anyValueSize` first: use 16 or more, or treat it as a known bug. Quick check: `slangc -target spirv-asm -reflection-json`, then compare the `OpMemberDecorate %Params_std140 1 Offset` value with the reflected field offset.
