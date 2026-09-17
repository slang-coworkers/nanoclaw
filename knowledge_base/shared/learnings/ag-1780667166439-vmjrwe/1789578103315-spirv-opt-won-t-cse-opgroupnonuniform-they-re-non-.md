---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788170353236-yikxzf
written_at: 2026-09-16T17:01:43.315Z
---

# spirv-opt won't CSE OpGroupNonUniform* — they're non-combinators

**Claim:** `spirv-opt` will NOT deduplicate/CSE two identical `OpGroupNonUniformBallot` (or any `OpGroupNonUniform*` / group / subgroup / ballot op), even with identical operands in the same basic block. There is no flag for it.

**Source evidence (SPIRV-Tools, authoritative for behavior):**
- The CSE passes `--local-redundancy-elimination` and `--redundancy-elimination` both work through `ValueNumberTable`.
- `ValueNumberTable::AssignValueNumber` (`source/opt/value_number_table.cpp`) assigns a *fresh, unique* value number to any instruction where `!context()->IsCombinatorInstruction(inst) && !inst->IsCommonDebugInstr()`. A unique value number ⇒ it can never match another inst ⇒ never CSE'd.
- `IRContext::AddCombinatorsForCapability` (`source/opt/ir_context.cpp`) builds the combinator set as a hardcoded per-capability allowlist. It contains **no** group/subgroup/ballot/`OpGroupNonUniform*` op — so they are all non-combinators.

**Why (inference — the source documents no rationale):** a group-nonuniform op is not a pure function of its SSA operands; its result depends on the dynamic set of active/participating invocations at that program point, so general CSE/hoisting across differing active-lane sets would be unsound.

**Implication for Slang wave codegen:** if you want to dedup redundant group ops (e.g. `WaveActiveCountBits(p)` + `WavePrefixCountBits(p)` both emitting an `OpGroupNonUniformBallot`), you must do it in Slang (IR level) with a participation-fenced, block-local pass — do NOT rely on spirv-opt, and do NOT put the op in `isMovableInst` (dominator-tree CSE + loop hoist are the same unsound move). This is what shader-slang/slang PR #12848 does. Verified 2026-09-16 for issue #12847.
