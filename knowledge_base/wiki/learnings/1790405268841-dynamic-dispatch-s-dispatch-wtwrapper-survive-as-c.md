---
title: "Dynamic dispatch: s_dispatch_*/wtwrapper survive as calls before v2026.18.2 (#12924); the constant-ID→tag mapping function is never inlined"
type: learning
topic: misc
source: learnings/1790405268841-dynamic-dispatch-s-dispatch-wtwrapper-survive-as-c.md
---

# Dynamic dispatch: s_dispatch_*/wtwrapper survive as calls before v2026.18.2 (#12924); the constant-ID→tag mapping function is never inlined

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790318106721-dgika6
written_at: 2026-09-26T06:47:48.841Z
---

# Dynamic dispatch: s_dispatch_*/wtwrapper survive as calls before v2026.18.2 (#12924); the constant-ID→tag mapping function is never inlined

From the #13266 follow-up (2026-09-26), checked with the official Linux binaries for 2026.17.1 and 2026.18.2 plus master 6eb89786c.

**Before 2026.18.2**
- The synthesized dispatcher (`s_dispatch_*`) and the witness-table wrappers (`*_wtwrapper*`) have no inline marking, so they stay as calls in the caller.
- Putting `[ForceInline]` or `[__unsafeForceInlineEarly]` on the user's default implementation only inlines it into the wrapper. The generated CUDA is identical either way.
- The outer result therefore gets `result = <call result>`, the aggregate-assign shape.

**From 2026.18.2 on (PR #12924, commit 76d3f1416; not an ancestor of v2026.17.1)**
- `addForceInlineDecoration` is applied to the wrapper (`slang-ir-lower-dynamic-dispatch-insts.cpp:195`) and the dispatcher (`:303`), except on CPU-via-LLVM targets.
- `performForceInlining` (`slang-emit.cpp:1839`) runs before `eliminatePhis` (`:2747`) and `simplifyForEmit` (`:3067`). So the concrete MakeStruct reaches the caller, and the result is written per field.

**Still true on master**
- The ID→tag mapping from `createIntegerMappingFunc` (`:409`; GetTagFromSequentialID site `:942`) has no inline decoration. `createDynamicObject<I>(constId, …)` inside `[ForceUnroll]` still emits `uint t = _S16(0U); switch (t) { …all arms… }` in every unrolled iteration, and folding it is left to the downstream compiler.

**DeepWiki is stale here.** It claims the dispatch functions are "not force-inline" and that the mapping gets constant-folded; both are wrong.

**Quick check:** download release tarballs with `gh release download vX -R shader-slang/slang -p 'slang-X-linux-x86_64.tar.gz'` and `grep -c 's_dispatch.*('` the `-target cuda` output.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1790405268841-dynamic-dispatch-s-dispatch-wtwrapper-survive-as-c.md`_
