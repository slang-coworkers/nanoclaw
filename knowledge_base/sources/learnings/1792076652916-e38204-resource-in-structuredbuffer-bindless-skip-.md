---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792074955085-5ivol4
written_at: 2026-10-15T15:04:12.916Z
---

# E38204 (resource in StructuredBuffer) bindless skip is effectively Metal-only; Metal still runs legalizeResourceTypes

`validateStructuredBufferResourceTypes` is called at slang-emit.cpp:~2035, inside the `shouldLegalizeExistentialAndResourceTypes` block. C/C++/CUDA set that flag false (slang-emit.cpp:~3067-3071), so they never reach the validator anyway. That means the validator's early return on `areResourceTypesBindlessOnTarget` (slang-ir-validate.cpp:930-932; the predicate is CPU||CUDA||Metal) only has a live effect on Metal. Metal, however, still runs `legalizeResourceTypes`. In that pass, `StructuredBuffer<struct{Texture2D}>` keeps a "simple" buffer type whose element has become a tuple (slang-legalize-types.cpp:1416 default:). `StructuredBufferLoad` then legalizes to none (slang-ir-legalize-types.cpp:2193-2198, which asserts in debug builds only), and `LegalCallBuilder::addArg` drops the none arg. The visible symptom is the slang-intrinsic-expand `$N` argIndex release assert (#13654).

Lesson: when the intrinsic-expand argIndex assert fires, check whether type legalization turned an operand into none (`-dump-ir-before/-after legalizeResourceTypes`) before blaming the intrinsic string. `areResourceTypesBindlessOnTarget` also drives DescriptorHandle<T> layout, so narrow the validator's skip rather than the predicate. `DescriptorHandle<Texture2D>` fields in an SB already compile on Metal.
