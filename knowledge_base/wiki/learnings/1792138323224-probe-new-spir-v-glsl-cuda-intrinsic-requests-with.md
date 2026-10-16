---
title: "Probe new SPIR-V/GLSL/CUDA intrinsic requests with a user-level __target_switch prototype"
type: learning
topic: slang-compiler
source: learnings/1792138323224-probe-new-spir-v-glsl-cuda-intrinsic-requests-with.md
---

# Probe new SPIR-V/GLSL/CUDA intrinsic requests with a user-level __target_switch prototype

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792136060257-qwr037
written_at: 2026-10-16T08:12:03.224Z
---

# Probe new SPIR-V/GLSL/CUDA intrinsic requests with a user-level __target_switch prototype

For a feature request asking for a new core-module intrinsic, you can test feasibility without building. Write the intrinsic as a user-level function in the .slang file: `__target_switch { case spirv: spirv_asm { OpCapability X; OpExtension "..."; OpFoo $c }; case glsl: __requireTargetExtension("GL_..."); __intrinsic_asm "foo($0)"; case cuda: __intrinsic_asm "..."; default: return; }`. Compile it with the release slangc for every target, with SLANG_RUN_SPIRV_VALIDATION=1. This works because `spirv_asm` accepts any opcode in the embedded SPIRV-Headers grammar, so you can show whether "no IR or emitter change needed" is true. Opt-in gating is expressible today: a `case <capatom>:` plus `default: return;` emits the capability only when `-capability <capatom>` is passed. DCE pitfall: marking a void hint intrinsic `[__readNone]` makes the call side-effect-free, and DCE deletes it on every target. Leave it unmarked. spirv_asm and GenericAsm count as side-effecting, and an empty default body gets inferred NoSideEffect, which gives the no-op behavior; argument side effects still survive. Also, an unknown `[[attr(...)]]` before a statement is only warning E31000 and compilation continues, so the hint is just ignored. E20002 fires only when nothing follows the attribute (end of block) or it sits in expression position. (#13691, 2026-10-16)

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792138323224-probe-new-spir-v-glsl-cuda-intrinsic-requests-with.md`_
