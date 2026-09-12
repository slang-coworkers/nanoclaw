---
title: "Threading language version into a parse breaks string-keyed reflection caches (m_types AND m_decls)"
type: learning
topic: slang-compiler
source: learnings/1789172398660-threading-language-version-into-a-parse-breaks-str.md
superseded_by: 1789172524588-threading-a-new-dependency-into-a-cached-parse-loo
---

# Threading language version into a parse breaks string-keyed reflection caches (m_types AND m_decls)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789152928485-2y0yxr
written_at: 2026-09-12T00:19:58.660Z
---

# Threading language version into a parse breaks string-keyed reflection caches (m_types AND m_decls)

**Context:** shader-slang/slang#13015. A fix threaded the linkage language version into the module-less reflection parse (`getTypeFromString`/`findDeclFromString` → `parseTermString`). That silently broke `ComponentType::m_types` and `m_decls`, which are keyed on the lookup **string alone**. A legacy compile request can change `-std` mid-session (a SUPPORTED, tested pattern — `reflectionRefreshesChangedLanguageVersion`), so `findTypeByName("(int, float)")` caches `float` (comma expr) under legacy and returns that stale `float` after `-std 2026` (should be a tuple → null).

**Rule:** A cache keyed on a string is only correct while the cached value depends on nothing but that string. The moment you make the parse/resolve version-sensitive, every such cache must include the version in its key: `Dictionary<{String, SlangLanguageVersion}, V>` via `SLANG_COMPONENTWISE_HASHABLE_2` + `SLANG_COMPONENTWISE_EQUALITY_2` (see `slang-spirv-core-grammar.h` for the idiom). Build the key from the same `linkage->m_optionSet.getLanguageVersion()` the parse/semantics use, for BOTH the get and the put.

**The non-obvious trap:** don't declare a sibling cache "version-independent, out of scope" without a generic-argument probe. `m_decls` looked safe — it caches a name→overload-set binding and the version-dependent *selection* is downstream in `specializeWithArgTypes` (which is why a bare-name test like `findFunctionByName("choose")` passes across a version change). But a decl **name** can smuggle version-differential grammar through a generic argument: `findFunctionByName("pick<(int, float)>")` names `pick<float>` (resolves) in legacy but does not resolve under 2026 (tuple). So `m_decls` is equally affected. Fix all caches of the class, not just the one with the obvious repro.

**Test mechanism:** to change `-std` in place on one linkage, use the legacy compile-request C API (`spProcessCommandLineArguments(request, {"-std","2026"})`) — the modern `ISession` API fixes the version at `createSession`. Separate reflection objects = separate caches, so a same-linkage test is required to catch cross-version staleness.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789172398660-threading-language-version-into-a-parse-breaks-str.md`_
