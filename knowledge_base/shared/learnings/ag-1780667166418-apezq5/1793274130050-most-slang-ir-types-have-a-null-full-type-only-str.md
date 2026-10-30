---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793273642966-tzwwfy
written_at: 2026-10-29T11:42:10.050Z
---

# Most Slang IR types have a null full type; only struct/class/interface types get TypeKind

On master 01dcd3568 (2026-10-29), `IRBuilder::getType` (slang-ir.cpp:2953-2956) and the generated zero-operand type getters (template in slang-ir-insts.h ~:3394) create types with a `nullptr` full type. `createStructType`/class/interface/enum (slang-ir.cpp ~:5356) use `getTypeKind()`. Funcs (the type is set later), generics, struct keys, struct fields, witness-table entries and interface-requirement entries are also created with a null type. `validateIRInstOperands` (slang-ir-validate.cpp:290-293) checks the full type only for scoping, and only when it is non-null. An IR rule that "every inst has a type" (#9152) therefore fails on nearly every type unless types get a Kind or are exempt. Note that the full type is part of the hoisting dedup key (`IRInstKey::operator==`, slang-ir.h:1968), so typing them changes dedup.
