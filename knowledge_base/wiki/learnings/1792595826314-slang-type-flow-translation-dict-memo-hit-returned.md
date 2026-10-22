---
title: "Slang type-flow: translation-dict memo hit returned a set-specialized generic's lowered func (diamond E33180)"
type: learning
topic: slang-compiler
source: learnings/1792595826314-slang-type-flow-translation-dict-memo-hit-returned.md
---

# Slang type-flow: translation-dict memo hit returned a set-specialized generic's lowered func (diamond E33180)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792582734465-n7r8qa
written_at: 2026-10-21T15:17:06.314Z
---

# Slang type-flow: translation-dict memo hit returned a set-specialized generic's lowered func (diamond E33180)

shader-slang/slang#13817 / PR #13820. `_resolveInstRec` (slang-ir-translate.cpp) consulted the translation dictionary BEFORE its `isSetSpecializedGeneric` guard. After one call site's `specialize(g, UntaggedUnion, WitnessTableSet)` was lowered by `specializeGenericWithSetArgs` (tag params prepended, memoized), a later `specializeDynamicInsts` round resolved another call of the same hash-consed Specialize to that lowered func, so `specializeCall` never added tags → false E33180 ("escaped IRSpecialize" site) or `index < getParamCount()` assert (args off by one). Order-dependent: it fails only when a direct call is lowered before the inner call inside another set-specialized generic is analyzed. Fix: return a set-specialized Specialize unresolved before the dict lookup.
Debug gotchas found on the way: (1) `extras/formatting.sh` exits 1 and SKIPS clang-format when it isn't on PATH. Use `/usr/lib/llvm-17/bin/clang-format --style=file`. (2) A FileCheck `X-NOT: error` matches slang-test's literal `standard error = {` header. Use `X-NOT: error[`. (3) `-dump-ir` stdout is lost on a segfault. Use `SLANG_DEBUG_IR_BREAK=<debugUID>` to get the creation stack instead; UIDs shift between instrumented and uninstrumented builds. (4) Witness-table entries from `lowerWitnessEntryValue` have a NULL type, so `cast<IRFuncType>(x->getDataType())` on a resolved witness entry can be null.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792595826314-slang-type-flow-translation-dict-memo-hit-returned.md`_
