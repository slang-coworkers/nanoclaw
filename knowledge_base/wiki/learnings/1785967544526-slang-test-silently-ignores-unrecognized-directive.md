---
title: "slang-test silently ignores unrecognized directive spellings (DISABLED_TEST)"
type: learning
topic: slang-compiler
source: learnings/1785967544526-slang-test-silently-ignores-unrecognized-directive.md
---

# slang-test silently ignores unrecognized directive spellings (DISABLED_TEST)

# slang-test silently ignores unrecognized directive spellings

**Mechanism, verified at source** (`tools/slang-test/slang-test-main.cpp`, origin/master b0e43d65):

1. `_extractCommand` (line 527) tokenizes `[A-Za-z_]+` up to `:` or `(`. A digit or other
   non-alpha char makes it return `SLANG_FAIL` → whole line skipped.
2. Line 668-677 strips **only the literal prefix `DISABLE_`**, then compares the remainder against
   `TEST` / `DIAGNOSTIC_TEST` / `TEST_CATEGORY` / `TEST_IGNORE_FILE` / `TEST_INPUT`.
3. Anything else hits the final `else` (~line 780): *"Hmm we don't know what kind of test this
   actually is. Assume that's ok and this \*isn't\* a test and ignore."* — dropped, **no diagnostic**.

⇒ **`//DISABLED_TEST` is inert.** It has a `D` where the recognized prefix has `_`, so it never
normalizes to `TEST`. 105 occurrences repo-wide. Same for `TEST_DISABLED` (6), `IGNORE_TEST`,
`DISABLED`, `NO_TEST`. Only `DISABLE_TEST` (887 uses) is the real spelling.

**Blast radius (4,618 test files under `tests/`):** **52 files** carry ≥1 test-directive-shaped
command but **zero** the harness recognizes — i.e. entirely invisible. By dir: compute 18,
language-feature 7, cross-compile 5, bugs 5, serialization/render/reflection/ir/autodiff 2 each,
then spirv, rewriter, nv-extensions, hlsl-intrinsic, hlsl, front-end, diagnostics ×1.

⭐ **SEVERITY IS BOUNDED — this is hygiene, not a correctness hole.** I searched for the dangerous
case (a directive whose author intended the test to **run**, silenced by the parser) and found
**none** in 4,618 files: no digit-bearing test tokens, no near-miss misspellings (`TSET`/`TESTS`),
no lowercase `//test:` directives. Every inert token is either (a) a **FileCheck label**
(`CHECK`, `BUF`, `METAL`, `SPIRV` — ignored by the directive parser *by design*, consumed by
FileCheck) or (b) a **deliberate disable**. **No test that should be running is being skipped.**
The cost is bookkeeping: these files look like "nothing to enable" to any audit that greps
directives, so enablement sweeps systematically miss them.

⚠️ **Do not report the raw "inert token" count as a defect count.** Most inert tokens are
FileCheck labels and correct. The defect subset is *test-directive-shaped* spellings only.

**Verified at source level, not empirically** — no `slang-test` binary in this container, so I did
not confirm the discovery count by running the harness. Anyone acting on this should do that first.

**How this surfaced:** scrubbing slang#7672 (CUDA enablement in `tests/compute`). Two coworkers
disagreed on the residue count — 8 vs 6. The gap was exactly the two files whose `-cuda` line uses
`//DISABLED_TEST` (`dynamic-dispatch-12`, `interface-param-partial-specialize`): one counted by
**author intent**, the other by **what the harness recognizes**. Both were correct; the
disagreement *was* the finding.

⇒ ⭐⭐ **When two parties' counts differ by a small delta, enumerate the delta members before
arguing methodology — the specific rows name the mechanism in one step.** See also: make buckets
sum to the population; a partition that doesn't total is the cheapest detector of a misclassifying
regex (my first pass gave 82/6/133 against 221 files and didn't sum).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785967544526-slang-test-silently-ignores-unrecognized-directive.md`_
