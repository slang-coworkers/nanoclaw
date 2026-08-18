---
title: "slang#12049 — generic entry-point -specialize can't see primary-file extension conformances (ad-hoc lookup starved)"
type: learning
topic: slang-compiler
source: learnings/1783701731376-slang-12049-generic-entry-point-specialize-can-t-s.md
---

# slang#12049 — generic entry-point -specialize can't see primary-file extension conformances (ad-hoc lookup starved)

# slang#12049 — `-specialize <T>` on a generic entry point fails to find extension-provided conformance declared in the primary source file

**Symptom:** `slangc file.slang -entry g -specialize float` on `void g<T:IDenorm>(...)` emits `error[E38029]: type argument doesn't conform to interface` when `float : IDenorm` is supplied by `extension<T:__BuiltinFloatingPointType> T : IDenorm` **in the same command-line source file**. Reproduced on ToT `85d79c676` (front-end error — no GPU needed; use `-target spirv-asm -skip-spirv-validation` to isolate from the sandbox's missing spirv-opt/glslang downstream libs).

**Root cause (traced):** `EntryPoint::_validateSpecializationArgsImpl` (source/slang/slang-check-shader.cpp:3419) constructs its checking context as `SharedSemanticsContext(getLinkage(), nullptr, sink)` — **m_module = nullptr** (line 3430). For a generic type parameter it synthesizes a `GenericAppExpr` and routes it through `visitor.CheckTerm(...)` (:3517) → normal generic-constraint machinery → `SharedSemanticsContext::getCandidateExtensionsForTypeDecl` (slang-check-decl.cpp:17221). That function branches on `m_module`: with **nullptr** it takes the "ad-hoc/API" mode (:17285) which enumerates extensions only from `m_linkage->loadedModulesList` (:17291).

**The gap:** the **primary command-line translation-unit module is never added to `Linkage::loadedModulesList`.** That list is populated only by `loadParsedModule` (slang-session.cpp:1134 — `import`ed source modules) and serialized-module loads (:1239). The primary TU is instead put in the request-local `loadedModules` dictionary (`FrontEndCompileRequest::checkAllTranslationUnits`, slang-compile-request.cpp:521) so future `import`s can discover it. So in the nullptr-module ad-hoc context, the primary file's extension conformances are invisible → witness for `float : IDenorm` not found → E38029.

**Decisive discriminator (verified empirically, not just reasoned):** move the identical interface+extensions into an **imported** module and `import` it → E38029 disappears (import goes through `loadParsedModule` → lands in `loadedModulesList` → visible). Only variable changed = primary-file vs imported-module. This also explains the reporter's two working workarounds: (a) manual-wrapper entry point proves `IDenorm` *inside the module body* where the context has a real `m_module`; (b) builtin-constrained (`__BuiltinFloatingPointType`) entry points need no extension-conformance discovery.

**Non-obvious fix subtlety:** the candidate-extension `m_module`-set branch (slang-check-decl.cpp:17267) adds only the module's `importedModulesList`, **NOT the module's own extensions** — it relies on `registerCandidateExtension` having populated the shared map during that module's own check. Contrast the sibling `_addDeclAssociationsFromModule` path (:17469-17476) which explicitly adds `m_module->getModuleDecl()` itself. So a *fresh* `SharedSemanticsContext` scoped to `EntryPoint::getModule()` starts with an empty map — passing the module to the ctor alone may not suffice; the own-module extensions must also be seeded. This asymmetry between the two sibling functions is itself suspect and is a candidate one-source-of-truth cleanup.

**Recommended fix:** scope the entry-point specialization's checking context to `EntryPoint::getModule()` (owning module is available via slang-entry-point.cpp:61) and make that module's own extensions visible — so the specialize boundary sees exactly what the module body sees. Reject "just add the primary TU to loadedModulesList" — that global list feeds many reflection/import/separate-compilation consumers; broad blast radius.

**Meta:** two Explore subagents converged on the nullptr-module context + the m_module-vs-loadedModulesList branch but left the "is the primary TU in loadedModulesList?" question open as a hypothesis. Resolving it required (1) reading `loadParsedModule` callers to see only imports/serialized hit the list, and (2) the imported-vs-primary control repro to confirm empirically. Lesson: when a triage hinges on "is X in list Y at time Z", build the smallest control that flips exactly that variable rather than shipping the hypothesis.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783701731376-slang-12049-generic-entry-point-specialize-can-t-s.md`_
