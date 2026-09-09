---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787775787100-bw4p3k
written_at: 2026-08-26T20:45:08.008Z
---

# Reflection getContentVarLayout: producer-side content array-layout for structured buffers (slang#12776)

Task: add a reflection accessor returning a container's "content" as a first-class *var* layout, uniform across CB/param-block/texture-buffer and structured buffers (slang#12776, consumer = the `reflection::Cursor` in PR #12715).

Key findings (verified in source, 2026-08):
- **All structured-buffer layout creation funnels through one function**: `createStructuredBufferTypeLayout(context, kind, sbType, RefPtr<TypeLayout> elementTypeLayout)` at `slang-type-layout.cpp:4402`. The `Type*` overload (:4446), the counter variant (:4362), and the 5 kind-dispatch call sites (~:5393-5451) all route into it. Attach any per-SB stored layout there once → stable pointer identity. `counterVarLayout` (`slang-type-layout.h:994`) is the existing precedent for an attached VarLayout on an SB layout.
- **Structured buffers have NO array layer**: `GetElementTypeLayout` returns element `T` directly and `GetElementStride` returns 0 for an SB. To give it a content array view, build an `ArrayTypeLayout` whose `->type = context.astBuilder->getArrayType(elementTypeLayout->type, nullptr)` (nullptr count = unbounded via `kUnsizedArrayMagicLength`), and compute `uniformStride` by reusing the element's own rules: `elementTypeLayout->rules->GetArrayLayout(SimpleLayoutInfo(Uniform,count,align), LayoutSize::infinite()).elementStride` — the SAME path a real array uses, so the stride is principled, not hand-rolled. `getKind()` derives from `->type`, so setting `->type` to an `ArrayExpressionType` makes the content report `Kind::Array`.
- **ABI**: `spReflectionTypeLayout_*` are free `SLANG_API` C functions (NOT COM vtable), C++ wrappers are opaque-handle structs. New accessor = append-only new C function + new wrapper method. Non-breaking, no vtable/enum touch. Prototype goes in `include/slang-deprecated.h`, wrapper in `include/slang.h`.
- **Test vehicle is a C++ unit test, NOT a `//TEST:REFLECTION` file**: the reflection-test JSON emitter (`slang-reflection-json.cpp`) only prints via *specific* named accessors. A brand-new accessor won't appear in JSON unless you also edit the emitter — which churns ~180 `.expected` baselines and is itself an output-format decision. Model the unit test on `tools/slang-unit-test/unit-test-atomic-reflection.cpp` (`loadModuleFromSourceString` + `getLayout`, no GPU). Unit-test .cpp files are auto-globbed into the `slang-unit-test` target (`tools/CMakeLists.txt`) — no CMake edit needed.
- **Design-flag handling**: when a triage/issue says "socialize the public API name/signature with maintainer X before locking", a **draft PR is the correct non-binding artifact** — you never mark ready/merge so nothing locks, and it gives the maintainer concrete build-verified code + a test pinning the semantics to react to, far better than prose. The consumer PR (#12715) had explicitly *deferred* SB content navigation pending exactly this confirmation.
