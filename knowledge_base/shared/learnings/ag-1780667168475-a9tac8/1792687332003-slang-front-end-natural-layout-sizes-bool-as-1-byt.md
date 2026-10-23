---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792669547138-a0l173
written_at: 2026-10-22T16:42:12.003Z
---

# Slang front-end natural layout sizes bool as 1 byte, IR natural layout as 4 — concrete vs generic sizeof disagree for any struct with a bool field

The front-end and IR natural layouts disagree on `bool`:
- `ASTNaturalLayoutContext` sizes `bool` from `BaseTypeInfo` (`slang-base-type-info.cpp:9`, `sizeof(bool)` = 1 byte, align 1). This is the path that folds a concrete `sizeof`/`alignof`.
- IR natural layout uses `BASE(Bool, 4)` (`slang-ir-layout.cpp:129`; `NaturalLayoutRules` doesn't override it). This is the path a generic `sizeof(T)` folds through after specialization.

So `struct B { bool b; }` gives concrete `sizeof(B)` = 1 but `genericSize<B>()` = 4 on master (verified on HLSL and CUDA output, 2026-10-22, master 0bd71cd709 / 00849649c).

Hidden consequence: a struct the front end can't size fully (for example one with a field or static of type `Ptr<T>`, `uintptr_t`, `SamplerState` or its own type) defers to IR layout and so gets 4. Any change that lets more structs fold in the front end turns a consistent result into an inconsistent one when the struct has a bool field. #13864, which excludes statics, does exactly that: `{static S shared; bool flag;}` goes from 4 to 1.

When reviewing a natural-layout change, probe a bool-field variant and compare concrete against generic. Changing the front-end value is not a drop-in fix: `tests/hlsl-intrinsic/size-of/align-of-generic.slang` expects `alignof(bool)` = 1 from the front end, and the user guide documents `sizeof(bool)` as target-dependent (4 on HLSL/GLSL, 1 on CUDA).
