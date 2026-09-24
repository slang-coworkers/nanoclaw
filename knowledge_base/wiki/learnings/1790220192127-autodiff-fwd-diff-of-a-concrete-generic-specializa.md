---
title: "Autodiff: fwd_diff of a CONCRETE generic specialization does not hit copyDebugInfo's generic path"
type: learning
topic: slang-compiler
source: learnings/1790220192127-autodiff-fwd-diff-of-a-concrete-generic-specializa.md
---

# Autodiff: fwd_diff of a CONCRETE generic specialization does not hit copyDebugInfo's generic path

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790170688411-buftjo
written_at: 2026-09-24T03:23:12.127Z
---

# Autodiff: fwd_diff of a CONCRETE generic specialization does not hit copyDebugInfo's generic path

A plausible-looking false-positive 🔴 in autodiff debug-info reviews: "fwd_diff of a named generic at -g2 aborts because copyDebugInfo (slang-ir-autodiff.cpp) gets a hoisted, name-hint-less IRGeneric as destFunc while srcFunc has a hint (firing the assert on the no-name-hint branch)."

Why it's usually wrong for a CONCRETE call like `fwd_diff(genPoly<float>)`: the specialization `specialize(genPoly, float)` is resolved to a MODULE-SCOPE cloned IRFunc first — `_resolveInstRec`/non-module-scope translation is rejected at `slang-ir-translate.cpp:430` (resolve at :379), and `slang-ir-specialize.cpp:4094` clones the wrapper's contents beside the module-scope specialization. So in `maybeTranslateForwardDerivative` (`slang-ir-autodiff-fwd.cpp:3518`) the generic-base branch `base = getGenericReturnVal(base)` at :3526/3527 is NOT taken for the concrete invocation; `targetFunc` is a module-scope IRFunc, `setInsertAfter(targetFunc)` (:3544) creates the derivative at module scope with its `s_fwd_<name>` hint, `findOuterGeneric(fwdDiffFunc)` is null so `hoistValueFromGeneric` (slang-ir-util.cpp ~446) returns the IRFunc (not a new generic), and `copyDebugInfo` takes the `if (nameHint)` branch — the release assert is never reached.

Corroborating signal: `_translateFuncImpl` does `cast<IRFunc>(fwdDiffFunc)` immediately after the copyDebugInfo call (fwd.cpp:2466) — though note this is SLANG_ASSERT-backed (slang-ir.h:861), so it's a debug-only cross-check, not a release-build proof; the specialization-to-module-scope trace is the decisive proof. When reviewing autodiff-of-generics claims, always check generic-vs-concrete: a concrete specialization is a module-scope func, not a nested generic.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790220192127-autodiff-fwd-diff-of-a-concrete-generic-specializa.md`_
