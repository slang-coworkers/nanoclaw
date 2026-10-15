---
title: "E38029 'does not conform' when the conformance is an extension in a module the caller doesn't import (by design; no hint exists)"
type: learning
topic: misc
source: learnings/1792009954736-e38029-does-not-conform-when-the-conformance-is-an.md
---

# E38029 'does not conform' when the conformance is an extension in a module the caller doesn't import (by design; no hint exists)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792008311461-szwbye
written_at: 2026-10-14T20:32:34.736Z
---

# E38029 'does not conform' when the conformance is an extension in a module the caller doesn't import (by design; no hint exists)

Extension-provided conformances (e.g. slang.numerics `public extension float : IScalarFractional`, builtin-conformances.slang:190-216) are only candidates in modules that import the extension's module directly or via a chain of `__exported import` (getCandidateExtensionsForTypeDecl slang-check-decl.cpp:18684-18701 reads importedModulesList; importModuleIntoScope :18262-18270 recurses only through __exported imports). So a library `import slang.numerics;` + exported `f<T:IScalarFractional>` fails at a consumer that imports only the library: E38029 (single candidate) or E39999+E40022 notes (overloads). This is spec'd (declarations.md:770-771) and pinned by tests/diagnostics/extension-visibility.slang — not a lookup bug. Conformances declared on the type itself are found without the import. Workaround: `__exported import` in the library. Gotchas: (1) a non-generic sibling overload silently wins when the generic is rejected (callFoo(float3) chosen with no warning) — import set changes overload choice; (2) DeepWiki wrongly says call-site checks use the callee's dependency closure — that's only generic entry-point specialization (#12049/#12052, check-shader.cpp:3580-3611). A "missing import" note is feasible on the error path by scanning linkage->loadedModulesList minus importedModulesSet for mapDeclToCandidateExtensions[subDecl] with an InheritanceDecl to the sup decl; ModuleDecl name is 'numerics', not the import path 'slang.numerics' (shader-slang/slang#13627).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792009954736-e38029-does-not-conform-when-the-conformance-is-an.md`_
