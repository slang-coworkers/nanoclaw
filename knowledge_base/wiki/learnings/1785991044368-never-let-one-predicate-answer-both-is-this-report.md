---
title: "Never let one predicate answer both 'is this reportable?' and 'is this legal?'"
type: learning
topic: misc
source: learnings/1785991044368-never-let-one-predicate-answer-both-is-this-report.md
---

# Never let one predicate answer both "is this reportable?" and "is this legal?"

## The defect

While adding a target-legality diagnostic to Slang (slang#12367 / PR #12378), I added a
`sourceLoc.isValid()` guard to both module-level checks. Its purpose was **presentation**: one
mistake was producing up to three errors, two of which pointed nowhere, because several synthesized
insts referred to the same value.

```cpp
auto key = field->getKey();
if (key->sourceLoc.isValid())          // <-- diagnostic-quality filter
    sink->diagnose(Diagnostics::FuncTypeNotSupportedOnTarget{.location = key->sourceLoc});
```

But that guard was also the **only** thing standing between an unrepresentable value and code
emission. So every locationless path became an *undiagnosed* path — and a declaration that arrives
via `import` has no location:

| how the identical declaration arrives | before |
|---|---|
| same translation unit | error, rc=255 ✅ |
| imported **as source** (`-I .`) | **rc=0, silent, invalid output emitted** ❌ |
| imported as **precompiled `.slang-module`** | **rc=0, silent** ❌ |

A peer reviewer found the precompiled pole; measuring on my own edge showed the plain-source-import
pole escaped too — so it wasn't a serialization bug, it was *any* import path. Nine
type-shape probes had missed it because the hole is reachable only by varying **how the declaration
arrives**, not what shape it has.

## The rule

**A predicate may answer "can I present this well?" or "is this allowed?" — never both.** When the
two share one condition, every input that fails the presentation test silently passes the legality
test. Symptoms to look for:

- a guard introduced for *message quality* (dedup, location, phrasing) sitting on the path that
  decides whether bad output is refused
- a check whose skip branch has no `else` that still rejects
- two sibling checks in the same pass disagreeing about whether the guard applies

## Fix the class, not the instances

The reviewer preferred a producer-side fix: make each producer stamp a location
(`funcPtr->sourceLoc = func->sourceLoc;` after the synthesizing call). That is the right instinct
for *diagnostic quality* and I did use it for one producer earlier. But as a **correctness** fix it
only reaches the producers you can enumerate — and the source-import pole is evidence that list
isn't closed.

So: report regardless of location, falling back to a use when the declaration itself has none.
Presentation quality is preserved where it actually mattered — the duplication arose in the
per-function walk, which keeps its own location check.

```cpp
auto loc = key->sourceLoc.isValid() ? key->sourceLoc : findFirstUseLoc(key);
sink->diagnose(Diagnostics::FuncTypeNotSupportedOnTarget{.location = loc});
```

A diagnostic with no `file:line` is worse than one with it, and far better than silently emitting
output the target cannot represent.

## Testing a locationless diagnostic

`DIAGNOSTIC_TEST(diag=…)` matches annotations **by column against a source line**, so it cannot
express a diagnostic that has no position — my first attempt (`diag=` + `non-exhaustive`, zero
annotations) passed **2/2 against the unfixed compiler**. A plain `//TEST:SIMPLE:` with a `.expected`
baseline is the only mechanism that works: it records `result code = 0` + empty stderr for the
pre-fix escape, versus `-1` + the error afterwards.

⚠ Two packaging traps: the baseline for the *second* directive in a file is `<test>.slang.1.expected`
(not `.slang.expected`), and in slang `*.expected` **and** `tests/**/*.slang-module` are gitignored —
so the baseline needs `git add -f` while the generated module must stay out. Verify with
`git diff --cached --name-only`.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785991044368-never-let-one-predicate-answer-both-is-this-report.md`_
