---
title: "'No import ⇒ cross-module logic cannot fire' is FALSE in Slang — the core module reports as `imported module 'core'`, so stdlib shadowing needs zero import lines"
type: learning
topic: slang-compiler
source: learnings/1786044404247-no-import-cross-module-logic-cannot-fire-is-false-.md
---

# "No import ⇒ cross-module logic cannot fire" is FALSE in Slang — the core module reports as `imported module 'core'`, so stdlib shadowing needs zero import lines

## The refuted claim

Implementing a warning for "an imported overload overrode a candidate from the call site's own
module" (slang#12284), I built a **structural filter** to cheaply exclude tests from re-run
classification:

> The predicate requires the winning candidate to come from an imported module, so a test file with
> no `import` / `__include` line cannot possibly trip it.

It sounds airtight and it is **false**. Measured with a file containing no imports at all:

```slang
RWStructuredBuffer<int> outputBuffer;
int max(int a, int b) { return a > b ? a : b; }     // local overload of a CORE name
[numthreads(1,1,1)][shader("compute")]
void computeMain(uint3 tid : SV_DispatchThreadID) { outputBuffer[0] = int(max(tid.x, 3u)); }
```
```
warning[E38208]: call to 'max' resolved to an overload from imported module 'core',
                 overriding a candidate declared in this module
  |     --- 'func max(int, int) -> int' declared in this module is not used
  |     ^^^ chose 'func max<uint>(uint, uint) -> uint' from imported module 'core'
```

**The core module is an imported module** as far as `getModuleDecl()` and the diagnostic are
concerned — it just has no `import` statement because it's implicit. Any reasoning of the form
"cross-module behaviour requires a visible import" is therefore unsound in this codebase.

## Why the argument was seductive

It was **structural**, not statistical — "cannot happen" rather than "didn't happen" — and I'd been
correctly preferring structural exclusions all session. But a structural argument is only as good as
its enumeration of the population, and mine silently equated *"modules that are imported"* with
*"modules named in an `import` line"*. The implicit member of a set is exactly the one an enumeration
misses.

⭐ **A structural exclusion is stronger than a statistical one only when the enumeration is complete.**
When it isn't, it's worse — because it licenses skipping the checks that would have caught it. I was
about to use this filter to skip individual re-runs during A/B delta classification.

## Practical notes

- For anything module-scoped in Slang, remember the implicit modules: `core`, plus `glsl` under
  `-allow-glsl`. Grep for the *behaviour*, not for the syntax that usually accompanies it.
- Counting caveat from the same exchange: `find tests -name "*.slang" | xargs grep -l …` → **242**;
  `grep -rl … tests/` → **255**. The 13-file gap is non-`.slang` files. Both correct for their scope;
  a count without its scope is not a fact. State the scope in the same breath as the number.
- The upside: this measurement *strengthened* the "no core-module carve-out" decision. The warning is
  silent for ordinary stdlib calls (no competing local declaration) and fires when a user's own
  overload is shadowed by a core one — which is the hazard the issue explicitly asked to surface. Same
  measurement, opposite conclusion to the one I feared.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1786044404247-no-import-cross-module-logic-cannot-fire-is-false-.md`_
