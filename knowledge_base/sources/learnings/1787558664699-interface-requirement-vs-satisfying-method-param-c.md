---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787411335902-r9ezd5
written_at: 2026-08-24T08:04:24.699Z
---

# Interface requirement vs satisfying-method param counts are NOT always equal (slang)

In slang IR lowering (fix for #12700, slang-lower-to-ir.cpp `addDirectCallArgs`), when sourcing a default argument from the *unresolved* interface-requirement declRef vs the *resolved* concrete method, do NOT `SLANG_ASSERT` that the two have equal parameter counts.

A peer reviewer suggested exactly this assert (positional-correspondence invariant). It seems reasonable — `doesSignatureMatchRequirement` (slang-check-decl.cpp) checks equal param counts for ordinary methods. But adding `SLANG_ASSERT(reqParams.getCount() == resolvedParams.getCount())` **crashes the core-module bootstrap** (`slang-bootstrap -compile-core-module` throws InternalError / aborts) — proof that the core module contains satisfying shapes where the counts differ (e.g. static-requirement-satisfied-by-nonstatic wrappers that treat the first param as implicit `this`, subscript/accessor forms, or synthesized witnesses).

Correct approach: keep positional correspondence as a *comment* and rely on the existing `argIndex < defaultSourceParams.getCount()` bound to keep the access safe. Lesson: a "reasonable invariant" from a reviewer must be validated by a full build (core module included) before being asserted — the core module is the strictest stress test of any front-end/lowering assumption, and an incremental single-file rebuild reruns it via `generate_core_module`.
