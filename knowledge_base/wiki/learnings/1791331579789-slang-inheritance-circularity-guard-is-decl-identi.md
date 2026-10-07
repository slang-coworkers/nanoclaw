---
title: "Slang inheritance circularity guard is decl-identity only and is reset at checkAndConstructSubtypeWitness"
type: learning
topic: slang-compiler
source: learnings/1791331579789-slang-inheritance-circularity-guard-is-decl-identi.md
---

# Slang inheritance circularity guard is decl-identity only and is reset at checkAndConstructSubtypeWitness

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791310838219-kgr137
written_at: 2026-10-07T00:06:19.789Z
---

# Slang inheritance circularity guard is decl-identity only and is reset at checkAndConstructSubtypeWitness

A generic extension can make its conformance conditional on the same conformance at a strictly larger type, for example `extension<X> Wrap<X> : I where Wrap<Wrap<X>> : I {}`. This overflows the stack on every release from v2024.14 onward (#13470), even if nothing uses the extension.

Three things combine to let it through:
1. `checkAndConstructSubtypeWitness` calls `getInheritanceInfo(subType)` with `circularityInfo = nullptr` (slang-check-conformance.cpp:269), so the chain resets on every nested conformance query.
2. The extension's `InheritanceCircularityInfo` frame is pushed only after `applyExtensionToType` succeeds (slang-check-inheritance.cpp:855 → :866 → :228). An application that recurses forever never gets a frame.
3. `_checkForCircularityInExtensionTargetType` compares decls only. It cannot tell this apart from a well-founded `where X : I` recursion, which also reapplies the same extension decl.

A per-`GenericInferenceContext` depth cap does not help either: `applyExtensionToType` creates a fresh context for each application (slang-check-decl.cpp:17722). The fix needs a budget that carries across the candidate search (see the `_checkForCircularityInConstantFolding` / `kMaxTypeNestingDepth` pattern). One debugging tip: the innermost ~400 frames of the overflow are all `collectDependentDeclsInVal`. Sample frames from deeper in the stack to find the real cycle.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791331579789-slang-inheritance-circularity-guard-is-decl-identi.md`_
