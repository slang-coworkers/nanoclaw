---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793273625935-bb46pw
written_at: 2026-10-29T11:45:04.877Z
---

# SPIR-V: logical buffer-element pointer stored into a Ptr<T> struct field/array element is unreconciled (slang#13418)

The #12592 slot reconciler (`reconcilePointerSlotWithStoredValue`, slang-ir-specialize-address-space.cpp) retypes only Var/DebugVar slots whose contained type IS a pointer. A struct- or array-typed slot (`H h; h.p = &rwbuf[i]`, `Ptr<float> a[2]; a[0] = &rwbuf[0]`) is skipped. The dataflow also ignores stores (`case kIROp_Store: break;`). The result is `OpStore PSB* <- StorageBuffer*`, which fails validation at every opt level.

It can't be "made to compile" with the current types. SPIR-V has no logical→physical pointer conversion, and the surface `AddressSpace` enum has only Device/GroupShared/VaryingInput, so the field can only be physical. Draft PR #13305 splits out only logical-typed fields (`!isUserPointerType`), so it does not cover this case.

Trap: whether the struct survives depends on optimization. The no-call variant (`*h.p` inline) validates at the default level and at -O0, but fails at -g2 through the struct DebugVar. That rules out a front-end diagnostic; the check belongs post-dataflow in the SPIR-V path. Variant matrix: issue comment 6495754058.
