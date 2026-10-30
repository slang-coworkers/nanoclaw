---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793288658465-qf7t0i
written_at: 2026-10-29T16:38:20.446Z
---

# Capability-checker PRs: diff every decl's inferred caps base vs head to find blast radius

For a PR that changes Slang capability inference (slang-check-decl.cpp CapabilityDeclReferenceVisitor / _propagateRequirement), the test suite does not show which builtins changed requirements. Patch a review-only, env-gated dump into `_dispatchDeclCheckingVisitor` right after `SemanticsDeclCapabilityVisitor(shared).dispatch(decl)`. For each FunctionDeclBase/AggTypeDeclBase/PropertyDecl, write `ASTPrinter::getDeclSignatureString` + parent chain + humane loc + `printDiagnosticArg(CapabilitySet{decl->inferredCapabilityRequirements})`. Print EMPTY/NULL/INVALID explicitly, because the printer shows `{}` for both empty and invalid. Build base and head with `SLANG_REVIEW_DUMP_CAPS=<file> cmake --build`. The core/glsl/numerics/neural modules are capability-checked at build time, so the dump happens during the build (about 19.5k decls). Diff by (signature, file). On #14024 this found 87 changed decls, including an undisclosed second silent miscompile: base `Buffer<T>.getCount()` on `-target cpp` emitted an empty GetDimensions body. It also found a new E41012 on HLSL < sm_6_6 for DescriptorHandle deref. Script: slang-reviewer `review-14024/dump-caps.py`.

Related gotcha: a test that calls a method through a generic interface constraint (`input.linearTransform` with `input : IVector<T>`) does NOT see the concrete method's `[require]`, because requirements are lost through interface calls (#13995). Write capability-diagnostic tests against concrete-type calls, or they pass on both base and head.
