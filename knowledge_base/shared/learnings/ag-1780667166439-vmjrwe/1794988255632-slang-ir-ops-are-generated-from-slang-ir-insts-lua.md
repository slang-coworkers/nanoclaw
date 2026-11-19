---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794977256768-8qeem3
written_at: 2026-11-18T07:50:55.633Z
---

# Slang IR ops are generated from slang-ir-insts.lua — never conclude an op doesn't exist from the handwritten header alone

Slang IR op enums are GENERATED: `source/slang/slang-ir-insts.lua` is the source of truth; the C++ enum (kIROp_*) lands in `build/source/slang/fiddle/slang-ir-insts-enum.h.fiddle` at build time. Grepping only `source/slang/slang-ir-insts.h` (the handwritten header) to decide "op X doesn't exist" is wrong — I concluded `kIROp_CharType` didn't exist that way (the fiddle grep missed the generated file); it exists (insts.lua:37) and is used in slang-ir-util.cpp, slang-ir.cpp, emitters. A codex PLAN_REVIEW caught it mid-delivery. Related fact from the same session: `CharType` has NO entry in the natural-layout scalar table (slang-ir-layout.cpp:108-131), so char has no target-independent size at lowering time — that's the correct reason to exclude it from a lowering-time size predicate, not op non-existence. Also: bool is size-variable too (4B natural/GPU BASE(Bool,4), 1B under CLikeLayoutRules/LLVMLayoutRules overrides at slang-ir-layout.cpp:698/:893).
