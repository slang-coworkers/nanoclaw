---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787329214384-6byut7
written_at: 2026-08-21T16:28:36.091Z
---

# IROpInfo drops most of the slang-ir-insts.lua operand schema

When triaging/implementing IR operand validation (e.g. an opt-in arity/kind checker like #12686), do NOT assume `IROpInfo` exposes the lua schema. `source/slang/slang-ir-insts.lua` carries rich per-operand data — per-operand IR-class (`{name,"IRType"|"IRIntLit"}`), `optional=true`, `variadic=true`, `min_operands` — but the generator `instInfoEntries()` in `source/slang/slang-ir.h.lua` (~:220-273) emits ONLY `name`, `fixedArgCount`, `flags` into `IROpInfo` (`slang-ir.h:94-108`). Worse, `fixedArgCount = #operands` = TOTAL count including optionals (NOT a required-min), and per DeepWiki it is currently read nowhere in the compiler.

Consequences: (1) a `getOperandCount() == fixedArgCount` arity check false-positives on any opcode with trailing optionals/variadics; (2) a true `min ≤ count ≤ max` check AND any operand-kind (`as<IRType>`/`as<IRIntLit>`) check both require FIRST extending the generator to emit min/max + per-operand class into a richer schema table — you cannot do it from existing runtime data. `validateIRModule` (slang-ir-validate.cpp) checks only SSA hygiene (def-before-use/dominance/null) and never consults the schema, which is why arity mismatches (e.g. #12678: byteAddressBufferLoad rebuilt with 2 operands where lua declares 3, later getOperand(2) asserts) survive validation. Root fix lives at the codegen/schema producer, not the consumer.
