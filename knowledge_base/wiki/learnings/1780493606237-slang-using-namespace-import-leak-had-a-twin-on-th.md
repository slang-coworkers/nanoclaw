---
title: "Slang: using-namespace import leak had a TWIN on the legacy/API lookup path"
type: learning
topic: slang-compiler
source: learnings/1780493606237-slang-using-namespace-import-leak-had-a-twin-on-th.md
---

# Slang: using-namespace import leak had a TWIN on the legacy/API lookup path

Fixing shader-slang/slang#11443 (a module's primary-file `using namespace Foo;` leaking through `import`). Two reusable lessons for the Slang frontend:

**1. A scope re-export filter usually has a TWIN on the legacy/API lookup path.** The `import` path filter is `SemanticsVisitor::importModuleIntoScope` (`source/slang/slang-check-decl.cpp`), which walks `moduleDecl->ownedScope`'s sibling chain. The reflection/API path — `ComponentType::_getOrCreateScopeForLegacyLookup` (`source/slang/slang-check-shader.cpp`), which backs `getTypeFromString`, string-specified entry points / type-conformance, and specialization-arg parsing — walks the SAME chain with a byte-identical predicate. Fixing only the `import` path left the leak open for `IComponentType::getLayout()->findTypeByName(...)`. When you touch a scope/lookup re-export filter, grep the whole tree for the predicate and fix the twin too. (We extracted a shared `isOwnModuleOrIncludedFileScope` helper so they can't drift.)

**2. The re-export keep-predicate must be `containerDecl == moduleDecl || (as<FileDecl>(containerDecl) && containerDecl->parentDecl == moduleDecl)`.** The `parentDecl == moduleDecl` conjunct is load-bearing (NOT defensive): a plain, non-`__exported` transitive `import` splices an imported module's OWN FileDecls (parentDecl == that other module) onto THIS module's re-export chain; the conjunct is the only thing keeping `import` non-transitive for them. A bare `as<FileDecl>` makes plain `import` transitive. Pin it with: a module `mid` that does plain `import leaf;` (leaf has an `__include`d public decl), then `top` does `import mid;` and references the decl unqualified → must be E30015; weakening the conjunct makes it leak.

**Meta-lesson:** before calling a guard clause "unreachable/defensive," enumerate ALL ways scopes populate the chain (transitive `import` re-export, not just `using`). And document what a guard GUARANTEES (drops foreign FileDecls by `parentDecl`), not speculative rejection diagnostics for alternative arrival paths — we guessed the `using namespace <module>` rejection reason wrong twice (E30600, then ExpectedANamespace; in fact `ModuleDecl : NamespaceDeclBase`, so a module satisfies the namespace cast). DIAGNOSTIC_TEST body-checking needs an entry point: `slangc mod.slang` with no entry/target doesn't check unreferenced bodies, so undefined-identifier errors don't surface; add `[numthreads] computeMain` calling the symbol + `-entry computeMain -stage compute -target hlsl`.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780493606237-slang-using-namespace-import-leak-had-a-twin-on-th.md`_
