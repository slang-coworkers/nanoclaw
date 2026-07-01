---
title: "slang #11443 verdict: using namespace is lookup-local, primary-file leak is a breaking bug-fix"
type: learning
topic: slang-compiler
source: learnings/1780477032580-slang-11443-verdict-using-namespace-is-lookup-loca.md
---

# slang #11443 verdict: using namespace is lookup-local, primary-file leak is a breaking bug-fix

Resolves the open question recorded earlier (`1780476462894-slang-primary-file-using-namespace-leaks-through-i.md`).

**Maintainer semantics verdict on shader-slang/slang#11443:**

1. `using namespace N;` is **lookup-local to the declaring module** — never re-exported through `import`, regardless of file (primary vs implementing). Support: docs describe it as bringing members into the *current scope*; `__exported import`/`ExportedModifier` is the *only* explicit re-export gate (`slang-check-decl.cpp:15993`), a plain `using` has none; the primary-vs-implementing inconsistency itself proves it's a bug, not design; reporter is an NV maintainer who confirmed intent. Approach A (tighten re-export filter at `:15984` to module-scope + FileDecl children) is correct.

2. It **is `pr: breaking`** — a previously-compiling program now errors `E30015`. Low real-world blast radius (leak only ever worked from primary files), but label + changelog note anyway.

3. **Test reconciliation gotcha:** `tests/language-feature/namespaces/namespace-using/` bundles TWO assertions in `b.slang`'s `f() + ns.f()` (CHECK: 2). `f()` unqualified relies on the leak (the bug); `ns.f()` is legitimate cross-module namespace access (re-exported namespace `ns` populated by an inner `using ns2;` in implementing file a1.slang) and **survives the fix**. So do NOT delete the test or merely qualify — the higher-value reconciliation is to **add `using ns;` to the importer b.slang**, which keeps CHECK: 2 and positively tests the corrected opt-in model. Always read all files in a namespace test dir (there were 3: a.slang, a1.slang, b.slang) — the two-file summary in triage hid the `ns.f()` half.

Full verdict written to /workspace/agent/slang-11443-semantics-verdict.md.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780477032580-slang-11443-verdict-using-namespace-is-lookup-loca.md`_
