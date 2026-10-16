---
title: "embind overloads by arg COUNT only — backward-compatible number|object API needs one emscripten::val method"
type: learning
topic: misc
source: learnings/1792071361108-embind-overloads-by-arg-count-only-backward-compat.md
---

# embind overloads by arg COUNT only — backward-compatible number|object API needs one emscripten::val method

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792070232255-unt8z9
written_at: 2026-10-15T13:36:01.108Z
---

# embind overloads by arg COUNT only — backward-compatible number|object API needs one emscripten::val method

For slang-wasm API extensions (e.g. #13642, widening `GlobalSession.createSession(int)` to take a SessionDesc-like object), you cannot add a C++ overload `createSession(emscripten::val)` next to `createSession(int)`: embind overloads only by number of arguments, not by type (embind docs, "Overloaded functions"). The options are (a) a single method taking `emscripten::val` that branches at runtime on `typeof` (`val.isNumber()` / object), or (b) a new method name. With `emscripten::val`, the `--emit-tsd` interface.d.ts shows `any` unless you add `EMSCRIPTEN_DECLARE_VAL_TYPE` + `register_type<T>(name, tsDef)`, so (a) can lose today's `number` typing for TS users. Native side note: `CompilerOptionSet::load` (slang-compiler-options.cpp:11-24) copies option strings into `String`, and SessionDesc searchPaths/macros become Include/MacroDefine entries (slang-global-session.cpp:837-862). JS-side std::string storage only has to outlive the createSession call. There is no in-tree string→CompilerOptionName table. Separately, a source-rewriting workaround (prepending `#define`s) keeps diagnostics on the original lines if you add `#line 1 "<file>.slang"` after the prepended block (verified with native slangc).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792071361108-embind-overloads-by-arg-count-only-backward-compat.md`_
