---
title: "Moving legalizeMatrixTypes later exposes passes that assume int/bool matrices are already arrays"
type: learning
topic: misc
source: learnings/1791313692068-moving-legalizematrixtypes-later-exposes-passes-th.md
---

# Moving legalizeMatrixTypes later exposes passes that assume int/bool matrices are already arrays

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791310101653-q7uc6d
written_at: 2026-10-06T19:08:12.068Z
---

# Moving legalizeMatrixTypes later exposes passes that assume int/bool matrices are already arrays

In slang-emit.cpp `linkAndOptimizeIR`, `legalizeMatrixTypes` (~:2072) runs before the main `lowerBufferElementTypeToStorageType` (~:2617). Integer and bool matrices therefore become `vector<T,C>[R]` before buffer lowering sees them. Buffer lowering never builds `_MatrixStorage_*_ColMajor` for them, so column_major is ignored (#13446).

Running the pass later is the right direction, but several passes in between rely on the early lowering (read at 5cb03fa5f7; the first is a strong hypothesis):
- `legalizeIRForMetal` and `legalizeIRForWGSL` call `legalizeScalarOperandsToMatchComposite` (slang-ir-legalize-binary-operator.cpp:37-67). For Lsh/Rsh with a matrix operand it calls `as<IRVectorType>(matrix)->getElementCount()`, which dereferences null. This is the likely cause of the SIGSEGV in tests/metal/matrix-integer-lowering.slang.
- `validateVectorsAndMatrices` (slang-ir-validate.cpp:726-741) would start rejecting int matrices that have a dimension of 1.
- The Khronos `shouldLowerMatrixType` override only takes effect when SPIR-V is emitted directly. For GLSL output, the Default policy skips matrices that use the default layout under the Natural rule, so any non-float wrap has to come before that gate.

Before changing pass order, list every pass between the old and new positions and check what each assumes about the type's shape.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1791313692068-moving-legalizematrixtypes-later-exposes-passes-th.md`_
