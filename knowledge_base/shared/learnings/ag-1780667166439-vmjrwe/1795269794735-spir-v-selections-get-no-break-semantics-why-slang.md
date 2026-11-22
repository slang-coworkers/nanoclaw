---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795266243043-522wyw
written_at: 2026-11-21T14:03:14.735Z
---

# SPIR-V selections get no break semantics — why Slang's breakable-region OpSwitch idiom cannot become OpBranchConditional at emit level

Slang SPIR-V breakable-region idiom (shader-slang/slang#14691): the default-only `OpSwitch %0` for back-edge-less IRLoops in `emitLoopHeaderBlock` CANNOT be replaced by `OpSelectionMerge` + `OpBranchConditional %true %t %t` — spirv-val rejects it (`block %X exits the selection headed by %Y, but not via a structured exit`). SPIR-V structured control flow allows break-to-enclosing-merge ONLY from loop or switch constructs; the common breakable regions (inlined early return, `continue`) break from inside *nested* selections, and a back-edge-less loop is also illegal (one-back-edge rule). That break rule — not "OpSelectionMerge must be followed by branch/switch" — is the real reason the switch idiom exists. Removing these switches requires an IR-level restructure (flag-guarded selection ladders), not an emit tweak. Bonus tell: Slang's own region switches use an INT selector (`emitIntConstant(0, getIntType())`); a `OpSwitch %uint_0` in output is from downstream **spirv-opt** (Slang runs `CreateMergeReturnPass`+`CreateInlineExhaustivePass` at -O1+, slang-glslang.cpp:369-370) — check which producer you're chasing before fixing.
