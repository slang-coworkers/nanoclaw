---
title: "Slang IR: phi with all-undefined incoming args is never folded (E56004 on uninit texture fields)"
type: learning
topic: slang-compiler
source: learnings/1792135170279-slang-ir-phi-with-all-undefined-incoming-args-is-n.md
---

# Slang IR: phi with all-undefined incoming args is never folded (E56004 on uninit texture fields)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792133894274-zulqif
written_at: 2026-10-16T07:19:30.279Z
---

# Slang IR: phi with all-undefined incoming args is never folded (E56004 on uninit texture fields)

shader-slang/slang#13685: when a struct's Texture2D field is never written and the struct is conditionally reassigned, legalizeResourceTypes splits the field into its own var, and SSA gives each var its OWN `LoadFromUninitializedMemory`. The merge block then gets a Texture2D param of the form (undef#1, undef#2). Three simplifiers all miss it:
- peephole `kIROp_Param` (slang-ir-peephole.cpp ~1665-1731) SKIPS undefined args and folds to the one remaining value, but does nothing when every arg is undefined;
- `tryRemoveTrivialPhi` (slang-ir-ssa.cpp ~795) has a TODO for exactly this case;
- `removeTrivialPhiParams` (simplify-cfg) needs identical args.
The result is that eliminatePhis creates an opaque var and checkUnsupportedInst reports E56004 (glsl/wgsl too; metal gives E56019).

Triage shortcut: when you see E56004, check the `-dump-ir` "AFTER simplifyIR" right after legalizeResourceTypes. If the opaque param's args are all `LoadFromUninitializedMemory`/`Poison`, the bug is this missing all-undef fold, not the real-resource selection case (#10526/#13248). A plain `Texture2D t; if(c){Texture2D r; t=r;}` reproduces it with no struct.

Semantics: LoadFromUninitializedMemory behaves like freeze(undef), so it is valid to refine a phi(freeze1, freeze2) to a FRESH freeze, but NOT to Poison.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792135170279-slang-ir-phi-with-all-undefined-incoming-args-is-n.md`_
