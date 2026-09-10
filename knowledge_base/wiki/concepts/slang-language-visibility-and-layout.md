---
title: "Slang Visibility, Layout & Codegen Surfaces"
type: concept
group: slang-language-core
tags: [visibility, module-accessibility, lambda, buffer-layout, cuda, descriptor-heap, ir-specialization, cmake, codegen]
source_count: 11
---

# Slang Visibility, Layout & Codegen Surfaces

Type-system-adjacent surfaces: module accessibility/visibility choke points, module-scope lambda name collisions, per-target buffer layout (CUDA/SPIR-V/Metal), descriptor-heap IR specialization, the CMake static-export guard, and IR-label/mangling and SPIR-V codegen notes. (Witness tables and conformance live in [[wiki/concepts/slang-language-witness-and-conformance.md]]; container coercion and overload resolution live in [[wiki/concepts/slang-language-coercion-and-overload.md]]; generic specialization and inference live in [[wiki/concepts/slang-language-generics-and-type-system.md]].)

## TL;DR

- Visibility has a single choke point (`isDeclVisibleFromScope`); Internal symbols are NOT stripped at IR lowering or serialization → visibility features are semantic-check-only. Member default visibility keys off the MODULE default, not the parent struct.
- Module-scope lambdas share the synthesized `_slang_Lambda_` name (E30200 collision) — the disambiguator is appended only in the function-scope branch.
- Never emit HLSL/target named constants as raw integers; verify per-target buffer strides GPU-free via `-target spirv-asm` (`OpDecorate ArrayStride`) / `-target metal`.
- Empty-struct CUDA layout mismatch only repros when the empty type is in the public/exported interface (`legalizeEmptyTypes` eliminates non-public ones).
- The `install(EXPORT SlangTargets)` static-export guard is obsolete (BUILD_LOCAL_INTERFACE wrapping); `find_package` configure ≠ full static link.
- Site 4 heap-load specialization is reachable only by a deferable struct/array arg (>128B or array fields); descriptor-heap unified stride is already supported via `-spirv-resource-heap-stride`, the gap is a max() policy.
- IR-LABEL test breaks: a renamed function (struct→extension ctor mangles as `%x24init`) is not an opcode change — anchor CHECK on opcode, not label.
- The SPIR-V `abort` message is a runtime `OpCompositeConstruct`, not `OpConstantDataKHR`; shipped #11542 emits the wrong OpExtension token (`SPV_KHR_shader_abort` vs `SPV_KHR_abort`).

## Module Accessibility and Visibility Choke Points

For any Slang visibility work (e.g. #10471 module-accessibility feature request, csyonghe-blessed design), several reusable facts: **visibility has a SINGLE choke point** — `SemanticsVisitor::isDeclVisibleFromScope` (`slang-check-expr.cpp`), whose `Internal` gate is `getModuleDecl(decl) == getModuleDecl(scope)` — called from the lookup-result filter and overload resolution; a "trampoline import" is just a scope-tagged bypass of this predicate. **Internal symbols are NOT stripped at IR lowering OR module serialization** — visibility is purely a semantic-check concern, so such features are semantic-checking-only with zero downstream work. **Member default visibility keys off the MODULE default, not the parent struct** — `getDeclVisibility` falls through to `Internal` unless the whole module is `public`, so `public struct Foo { int a; }` leaves `a` internal (the reporter's pain); E30601 allows *equal* visibility so defaulting members to the struct's own visibility is compatible. Per-import modifiers already exist (`__exported` gates re-export recursion) as the exact template for a new import modifier. Disposition for a core-architect-blessed design with no bot ask: PARK at triaged, endorse the maintainer's scope-reductions, no auto-dispatch ([slang#10471 module accessibility — maintainer-blessed design; both parts semantic-check-only](../learnings/1783523027176-slang-10471-module-accessibility-maintainer-blesse.md)).

Feature #9153 — "public struct ⇒ members public by default", gated on language version ≥ 2026 (maintainer jkwak-work authorized Proposal 1) — is likewise semantics-only at `getDeclVisibility`, mirroring the existing interface-member rule ([slang#9153 public-by-default structs — semantics-only at getDeclVisibility, mirror the interface rule](../learnings/1784153822100-slang-9153-public-by-default-structs-semantics-onl.md)).

## Module-Scope Lambda Name Collision

Two or more lambda expressions at module/global scope collide on the shared synthesized struct name `_slang_Lambda_`, giving `error[E30200]: conflicting declaration` (#11963; not attribute-specific — bare `IFunc<bool> g1=()=>true; g2=()=>true;` at global scope fails identically). Root cause: `SemanticsExprVisitor::visitLambdaExpr` disambiguates the synthesized `LambdaDecl` name ONLY in the function-scope branch (appends `<funcName>_<memberCount>`); the global-scope `else` branch adds the decl with the bare `_slang_Lambda_`, so a second module-scope lambda trips the name-keyed redeclaration check. Producer-side fix: append a counter in the global-scope branch too (`nameBuilder << m_outerScope->containerDecl->getDirectMemberDeclCount()`). `tests/language-feature/lambda/` has no module-scope-lambda coverage — the gap that let it slip ([Lambda name synthesis omits disambiguator at module scope (_slang_Lambda_ collision)](../learnings/1783407191560-lambda-name-synthesis-omits-disambiguator-at-modul.md)).

## CMake / Build System (type system adjacent)

The `if(NOT SLANG_LIB_TYPE STREQUAL "STATIC")` guard around `install(EXPORT SlangTargets)` (PR #6158) is obsolete because `slang_add_target` wraps private deps in `$<BUILD_LOCAL_INTERFACE:...>`. Removing it is safe for configure but does not fix full static linkability — `find_package(slang)` configures fine while `target_link_libraries(... slang::slang)` still fails on undefined refs ([Slang #6158 static-export guard is now obsolete (BUILD_LOCAL_INTERFACE wrapping)](../learnings/1780467490251-slang-6158-static-export-guard-is-now-obsolete-bui.md), [Slang static install: find_package configure ≠ link (BUILD_LOCAL_INTERFACE strips private deps)](../learnings/1780471907292-slang-static-install-find-package-configure-link-b.md)).

## Buffer Layout and CUDA

An empty struct used as a member in a `ParameterBlock`-backed struct causes host/device layout mismatch on CUDA: reflection treats it as size 0, but the C-like emitter emits it as a real C++ member (sizeof == 1), pushing the next field's offset. The bug only surfaces when the empty struct is in the public/exported interface — `legalizeEmptyTypes` eliminates non-public empty types ([Empty-struct CUDA layout bug only repros when the empty type is in the public/exported interface](../learnings/1781713263122-empty-struct-cuda-layout-bug-only-repros-when-the-.md)).

Per-target buffer layout (Vulkan/Metal/CUDA) can be verified without a GPU by examining `slangc -target spirv-asm` for `OpDecorate ArrayStride` and `-target metal` for packed vs plain field types ([Verify per-target Slang buffer strides WITHOUT a GPU; reflection reports natural not ScalarDataLayout](../learnings/1780598922131-verify-per-target-slang-buffer-strides-without-a-g.md), [Testing the buffer-load-arg (Site 4) heap-load specialization path](../learnings/1780769206960-testing-the-buffer-load-arg-site-4-heap-load-speci.md)).

## Descriptor Heap and IR Specialization

The Site 4 heap-load specialization path (`IRSPIRVLoadDescriptorFromHeap` arm in `FuncBufferLoadSpecializationCondition::doesParamWantSpecialization`) is only reachable by a deferable struct/array argument. A struct qualifies when its natural size exceeds 128 bytes or it contains array fields ([Testing the buffer-load-arg (Site 4) heap-load specialization path](../learnings/1780769206960-testing-the-buffer-load-arg-site-4-heap-load-speci.md)). The descriptor-heap unified stride feature is already supported via `-spirv-resource-heap-stride`; the open gap is a "unified max()" policy across resource types ([slang descriptor-heap unified stride (#11718) — already-supported extension, gap is stride policy not the extension](../learnings/1782264486800-slang-descriptor-heap-unified-stride-11718-already.md)).

## IR Label Tests and Mangling

When an auto-generated IR-LABEL test fails after a refactor, distinguish a function rename (label not found) from an opcode change (label found but body differs). An extension ctor mangles differently than a struct ctor: `CoopVec.$init` → `%x24init`. The CHECK should anchor on the opcode, not the function label ([IR-LABEL test breaks: a renamed function (struct→extension) is not an opcode change — verify which one broke](../learnings/1782295021483-ir-label-test-breaks-a-renamed-function-struct-ext.md)).

## SPIR-V `abort` Intrinsic

`abort<each T>(format, args...)` takes runtime variadic args; the message struct is an `OpCompositeConstruct`, not `OpConstantDataKHR`. The shipped PR #11542 has a conformance bug: the emitted extension token is `"SPV_KHR_shader_abort"` (the Vulkan extension name) rather than the correct SPIR-V grammar token `"SPV_KHR_abort"` ([CORRECTION: abort message is a runtime composite (runtime args), not OpConstantDataKHR; shipped #11542 bug is the wrong OpExtension token](../learnings/1782251874470-correction-abort-message-is-a-runtime-composite-ru.md)).

**Source learnings (11):**
- [Slang #6158 static-export guard is now obsolete (BUILD_LOCAL_INTERFACE wrapping)](../learnings/1780467490251-slang-6158-static-export-guard-is-now-obsolete-bui.md)
- [Slang static install: find_package configure ≠ link (BUILD_LOCAL_INTERFACE strips private deps)](../learnings/1780471907292-slang-static-install-find-package-configure-link-b.md)
- [Testing the buffer-load-arg (Site 4) heap-load specialization path](../learnings/1780769206960-testing-the-buffer-load-arg-site-4-heap-load-speci.md)
- [Verify per-target Slang buffer strides WITHOUT a GPU; reflection reports natural not ScalarDataLayout](../learnings/1780598922131-verify-per-target-slang-buffer-strides-without-a-g.md)
- [Empty-struct CUDA layout bug only repros when the empty type is in the public/exported interface](../learnings/1781713263122-empty-struct-cuda-layout-bug-only-repros-when-the-.md)
- [CORRECTION: abort message is a runtime composite (runtime args), not OpConstantDataKHR](../learnings/1782251874470-correction-abort-message-is-a-runtime-composite-ru.md)
- [slang descriptor-heap unified stride (#11718) — already-supported extension, gap is stride policy](../learnings/1782264486800-slang-descriptor-heap-unified-stride-11718-already.md)
- [IR-LABEL test breaks: a renamed function (struct→extension) is not an opcode change](../learnings/1782295021483-ir-label-test-breaks-a-renamed-function-struct-ext.md)
- [slang#10471 module accessibility — maintainer-blessed design; both parts semantic-check-only](../learnings/1783523027176-slang-10471-module-accessibility-maintainer-blesse.md)
- [Lambda name synthesis omits disambiguator at module scope (_slang_Lambda_ collision)](../learnings/1783407191560-lambda-name-synthesis-omits-disambiguator-at-modul.md)
- [slang#9153 public-by-default structs — semantics-only at getDeclVisibility, mirror the interface rule](../learnings/1784153822100-slang-9153-public-by-default-structs-semantics-onl.md)
_Catalog: [[wiki/index.md]]_
