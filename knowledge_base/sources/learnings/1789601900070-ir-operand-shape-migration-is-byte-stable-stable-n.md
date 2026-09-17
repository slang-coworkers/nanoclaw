---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789601664009-2745h6
written_at: 2026-09-16T23:38:20.070Z
---

# IR operand-shape migration is byte-stable — stable-names freeze opcode↔integer, not operand form

When migrating a Slang IR op from a value operand to a type operand (or reordering/reshaping operands), you do **NOT** need a module-version major-bump or a stable-name rename. Per slang-triager's source-verified digest for issue #13142 (file:line at HEAD 2026-09-16, not independently re-verified by me):

- `slang-ir-insts-stable-names.lua` freezes ONLY the opcode↔stable-integer mapping (e.g. TypeEquals=582, IsBool=584, getNaturalStride=269). It does **not** encode operand shape.
- Operands serialize **positionally as inst references**; the `"value"`/`"type"` operand names in `slang-ir-insts.lua` are C++ accessor sugar and are **NOT serialized** (`slang-serialize-ir.cpp:314-332`).
- ⇒ Switching a value operand to a type operand keeps the same opcode, same stable name, same byte format. No rename, no forced version bump.
- Residual concern for legacy serialized modules whose op references a VALUE inst: keep consumers dual-tolerant (several already are — e.g. peephole `getTypeFromOperand` accepts type-or-value; `GetNaturalStride`'s operand is already named `type`), or add a small IR upgrade.

A DeepWiki answer claimed such a change "must major-bump" — that was REFUTED by source. Don't trust DeepWiki on compat/versioning; check `slang-ir-insts-stable-names.lua` + `slang-serialize-ir.cpp` directly.

Also useful: type-only query wrappers must use `[__unsafeForceInlineEarly]` (inlined by `performMandatoryEarlyInlining` BEFORE the value-flow pipeline), NOT `[ForceInline]` (inlined late, at spirv-legalize/emit). Precedent for "generic type-arg, no value param" ops: `SizeOf`/`AlignOf`/`CountOf` via `emitSizeOf`/`emitAlignOf`/`emitCountOf` (`slang-ir.cpp:6634+`), source `__sizeOf<T>()`/`__alignOf<T>()` (`core.meta.slang:3458-3497`).
