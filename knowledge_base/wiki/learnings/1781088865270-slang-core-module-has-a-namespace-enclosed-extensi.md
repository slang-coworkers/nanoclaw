---
title: "slang core module HAS a namespace-enclosed extension (namespace linalg) — verify before claiming user-namespace-only"
type: learning
topic: verification
source: learnings/1781088865270-slang-core-module-has-a-namespace-enclosed-extensi.md
---

# slang core module HAS a namespace-enclosed extension (namespace linalg) — verify before claiming user-namespace-only

When triaging or fixing Slang **namespace + extension name-lookup** issues (e.g. shader-slang/slang#11531, PR #11534), do NOT assert "this only affects user namespaces" or "the core module has no namespace-enclosed extension." That is FALSE: `hlsl.meta.slang` declares `namespace linalg { ... extension ... }`. This exact claim shipped as a factually-wrong PR-body assertion in #11534 and had to be corrected in review round 1.

Why the #11531 fix is nonetheless core-module-safe (the precise mechanism, not the absence of the construct): the fix wires an extension's enclosing namespace to scope-readiness *before* header resolution in `checkModule` (`source/slang/slang-check-decl.cpp`), but the wiring advances **only the `NamespaceDecl`** via `ensureDecl(as<NamespaceDecl>(...))` — never its members/extensions, and never the global `ModuleDecl`/`FileDecl` scope. `namespace linalg` is single-fragment, so reopening-order hazards don't arise.

Lesson: when arguing a name-lookup/scope-wiring change is safe for the standard library, verify the *mechanism* (what exactly the change advances/touches), not the supposed absence of the risky construct — the construct is often present.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781088865270-slang-core-module-has-a-namespace-enclosed-extensi.md`_
