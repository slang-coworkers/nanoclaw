---
name: project_12270_buildhash_ignores_intvalue2
description: "slang#12270 — buildHash ignores intValue2 (shader-cache key collision); triaged P2, →fixer"
metadata: 
  node_type: memory
  type: project
  originSessionId: 75e05fc0-79fb-4233-9227-93c71fadb439
---

# #12270 — buildHash ignores intValue2 for multi-integer options

`CompilerOptionSet::buildHash` (`source/slang/slang-compiler-options.cpp`) appends only
`v.intValue` for Int-kind values, never `v.intValue2` — while the String branch appends
both stringValue+stringValue2. Options packing two ints (VulkanBindGlobals `-fvk-bind-globals
<index> <set>`, VulkanBindShift, VulkanBindShiftAll, TraceCoverageBinding) hash identically
when only the 2nd operand differs. The digest keys getEntryPointHash (shader cache,
`include/slang.h:5379`) AND isBinaryModuleUpToDate (module freshness) → cache can return
wrong artifact.

**Triage (slang-triager, 07-29):** bug/correctness/P2, frontend(CompilerOptionSet)+caching.
Code-trace confirmed @HEAD `71a3f7e71` (API-only, not empirically run → no `reproduced` label).
Verdict posted (comment 5122051359); Issue Type set Bug. Recommended fix **A** = one line
`builder.append(v.intValue2);` mirroring String case (fixes all four generically); B (pack)
& C (hash CLI) rejected. Guard w/ inverse digest-stability unit test.

**Chain:** →slang-fixer on canonical thread `gh-issue-shader-slang/slang-12270`; triager owns.
Fixer opened **DRAFT PR #12271** (branch `fix/issue-12270`). Reviewer edge: fixer has none, so
review runs FOREGROUND under Main — Main dispatches slang-reviewer, relays verdict down to
triager→fixer. Drafts-only OP-gated.

**SCOPE EXPANSION (07-30, @pdeayton-nv req):** maintainer asked for a fuller cache-key hash audit.
Fixer verified 3 more issues at HEAD + posted audit on PR → now **4 fixes**:
- **A** original `intValue2` drop in `buildHash` Int branch (=Approach A).
- **B** REAL bug — `add()` duplicate-replace writes `intValue2 = element.intValue` (should be
  `.intValue2`), `slang-compiler-options.h:157`.
- **C** REAL collision — `DigestBuilder::append(String)` has no length delimiter, so
  `MacroDefine("AB","C")` hashes == `("A","BC")`.
- **D** insertion-order sensitivity in OrderedDictionary → spurious cache MISS (not wrong-artifact);
  fixer canonicalizes by sorted enum key.
All same subsystem (cache-key completeness), maintainer-requested → NO re-triage (triager confirmed).

**Reviewer HELD:** the 1-line diff @`562ae25121` is now STALE; Main told slang-reviewer to stop that
pass (kept subsystem grounding). Fixer expanding PR + tests + re-verify; re-dispatch reviewer on the
fresh diff, then relay verdict fixer→triager→upstream `[Triage Resolution]`.

Siblings: split from #12257 (serialize-audit, OPEN) at @pdeayton-nv req; shares
`-fvk-bind-globals` surface w/ [[project_10668_fvk_bind_globals_set_binding_conflict]].
