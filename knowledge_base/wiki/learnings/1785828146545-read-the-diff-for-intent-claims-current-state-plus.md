---
title: "Read the DIFF for intent claims — current-state-plus-title omits authorial intent, and slang-test -OX can't override a directive's own -O flag"
type: learning
topic: slang-compiler
source: learnings/1785828146545-read-the-diff-for-intent-claims-current-state-plus.md
---

# Read the DIFF for intent claims — current-state-plus-title omits authorial intent, and slang-test -OX can't override a directive's own -O flag

# Two findings from a four-round detour that a `git show` would have ended

**2026-08-04**, shader-slang/slang#11616 / PR #11617. Companion to
*"Control the instrument, not the reasoning"* — this is the **fourteenth** instance in that session and
a distinct failure class from the instrument defects catalogued there.

## ⭐ 1. For a claim about INTENT, the diff is the artifact — state and title are not substitutes

Two tiers spent four rounds deriving *why* a test assertion would be brittle (IR branch structure,
inst arity, emit-layer provenance — all correct, all independently verified). The answer was in the
patch that created the assertion:

```diff
# git show <sha> -- tests/.../forceinline-multiple-cases.slang
-//TEST:SIMPLE(filecheck=CHECK): … -g3
+//TEST:SIMPLE(filecheck=CHECK):   … -g3 -O0
+//TEST:SIMPLE(filecheck=NOSCOPE): … -g3 -O0
```

The author added the **`-O0` pin in the same commit** as the assertion block. So the pin *was* his
optimization-robustness mechanism — for checks that legitimately depend on unoptimized structure, he
pinned the directive rather than loosening the checks. Both tiers had written a requirement ("the new
assertion must be optimization-robust") that **mis-stated the goal**: for that file, robust means
*pinned*, and it already was. A `-O1` failure described a configuration the test cannot run in.

> **Current-state-plus-title reads cheaper than the diff, and it silently omits authorial intent** —
> which was the exact thing being reasoned about.

This is a different defect from "the instrument dropped the data" (see the `sed`-citation tell in the
companion note). Here the instrument answered a **different question**: what the code says *now*,
rather than what the author was *doing*. Three separate failures in one session traced to this one
missing read — one tier misattributed intent from a commit title, another **fabricated** a title
outright, and both rulings reasoned from titles. None would have survived `git show <sha> -- <path>`,
which was two calls away throughout.

**Rule:** any claim of the form "this assertion/guard/flag exists in order to …" requires the
introducing commit's diff. Find it with `git log --oneline -- <path>` then `git show <sha> -- <path>`.

## 2. `slang-test -OX <file>` does NOT override a test directive's own `-O` flag

A fixer reported "verified at `-O1/-O2/-O3`" — four passes. The directive hardcodes `-O0`, so all four
runs **compiled identically at `-O0`**: four green results, one measurement.

Mechanism, at `tools/slang-test/slang-test-optimization-options.h`:
- `:14` — `kTestOptimizationOption = "-O0"`, the suite-injected default.
- `:19-44` — `isSlangOptimizationArg()` matches any `-O<level>` in **slangc's own** spellings; its
  comment states the intent: *"so unrelated options with a `-O` prefix do not accidentally opt a test
  out of the slang-test default."*
- `:56+` — `hasSlangOptimizationArg(args)`, true when a command line already specifies a level.

⇒ **A directive carrying its own `-O` opts that test out of the suite-level injection.** To measure
optimization sensitivity, invoke `slangc` directly per level — do not pass `-OX` to `slang-test` and
assume it took effect.

Same shape as the `$?` traps: *an instrument that reports success without doing the work.* A flag that
is silently ignored is indistinguishable from a flag that was honored, unless you check that it changed
something.

## Concrete data (may be useful; re-measure before citing)

`tests/language-feature/function-calls/forceinline-multiple-cases.slang` at master,
`-target spirv-asm -g3`, anchored on `OpExtInst %void %N DebugNoScope`:

| level | `DebugNoScope` | one-operand `DebugScope` |
|-------|----------------|--------------------------|
| `-O0` | 14             | 9                        |
| `-O1` | 16             | 9                        |
| `-O2` | 12             | 9                        |
| `-O3` | 12             | 9                        |

The author's own `CHECK-COUNT-14` breaks at *every* non-zero level — which is why he pinned. Note the
brittleness is confined to the `DebugNoScope` count; the restore count is stable. **Anchor these greps**
— `-g3` embeds source, so the test's own `NOSCOPE` *comment* lines match a naive `grep -c` (16 raw
mentions vs 14 emitted).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785828146545-read-the-diff-for-intent-claims-current-state-plus.md`_
