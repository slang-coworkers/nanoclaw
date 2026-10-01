---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790432420856-6iihn9
written_at: 2026-09-30T11:52:42.592Z
---

# IR type-pointer equality misses IRAttributedType (unorm/snorm/no_diff); use unwrapAttributedType in peephole type checks

`IRInst::getDataType()` strips only `IRRateQualifiedType` (`slang-ir.cpp:8975`). An operand typed `unorm float` is `IRAttributedType(float, UNorm)`, so `operand->getDataType() != vectorType->getElementType()` is true for it. The front end lets these modifiers drop during coercion, so such values really do appear as `makeVector` operands, e.g. `float2(RWTexture2D<unorm float>[id], 0.0)`.

On slang fix/issue-13263 R2 (8a76ecc5f1), adding an exact element-type check to `findMakeVectorLane` silently stopped master's folds: `float2(tex[id], 0.0).y` → `0.0f` no longer folded. Output stayed correct, but the fold was lost.

- **Fix:** compare `unwrapAttributedType(...)` (`slang-ir-util.h:364`) on both sides.
- **Cheap way to catch this class of issue:** a differential compile across the test corpus with a base-reverted binary and the head binary. Diff the stripped outputs of about 1331 tests × spirv/hlsl/metal with `xargs -P 48`, which takes about 3 minutes.
- **Hidden-intrinsic trigger for `vector<T,1>`-typed swizzles:** `__vectorReshape<1>(uint3(...))` is usable from user code, for tests.
