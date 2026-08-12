# slang-test silently ignores misspelled directives: only the prefix DISABLE_ is stripped

**The harness recognizes exactly one disable spelling, and every other spelling is inert text that produces no warning.**

In `tools/slang-test/slang-test-main.cpp`, the directive parser strips only the **prefix** `DISABLE_` (`disablePrefix` declared at `:670`, applied at `:675-679`), then matches the remainder against `TEST` / `DIAGNOSTIC_TEST`. Anything else falls to the unknown-command branch at `:781-786` — *"Hmm we don't know what kind of test this actually is"* — and is **skipped silently**.

Measured with three probe files (identical bodies, one directive line each):
- `//TEST(compute):…` → 2 tests collected
- `//DISABLE_TEST(compute):…` → `0% of tests passed (0/0), 2 tests ignored` ← recognized, disabled
- `//TEST_DISABLED(compute):…` → **`no tests run`** ← not a directive at all

So `//DISABLE_TEST` is the only working spelling (documented at `tools/slang-test/README.md:100`, also mentioned in `AGENTS.md:166`).

**This is widespread, not hypothetical.** Counting `.slang` files under `tests/compute` at HEAD `b0e43d657`: **40 inert directive lines** — 33 `//DISABLED_TEST` across 19 files, 6 `//TEST_DISABLED` across 5, 1 `//IGNORE_TEST` — against **77** correctly-spelled `//DISABLE_TEST` lines. Tree-wide, the inert `//DISABLED_TEST` form appears in **48** `.slang` files under `tests/` (53 including `.hlsl`/`.frag`). Most are presumably intended as disabled and are harmlessly inert — but they are **indistinguishable from a typo that silently drops a test someone meant to run**, and nothing warns. Note `shader-slang/slang#7672`'s own body names `TEST_DISABLED` as the disable mechanism, so the misconception is in a maintainer-written spec too.

**Two grep traps I hit while counting this — the second is the same bug class as the finding itself:**

1. `grep -hoE '^//DISABLE_TEST[A-Z_]*'` returns **79**, but two matches are `//DISABLE_TEST_INPUT` (`tests/compute/half-texture-simple.slang:10`, `texture-simple.slang:9`). An unanchored directive pattern over-counts by prefix-matching a *different* directive. Anchor on the boundary:
   `grep -rhoE '^[[:space:]]*//[[:space:]]*DISABLE_TEST([(:]|$)' tests/compute --include='*.slang'` → **77**.
2. Sweeping that defect class, my "53 files tree-wide" became 48 — but the cause was **not** anchoring (anchored and unanchored both give 48 at `--include='*.slang'`); 53 came from a `git grep` with **no file-type filter**, picking up 5 `.hlsl`/`.frag` files. Both numbers are true of their own scope. ⇒ Sweep the class, then diagnose each instance separately rather than assuming one cause.

Also: `//TEST_INPUT:` is data setup, not a test directive — a pattern like `^//TEST` counts 219 of them in `tests/compute` and inflates any directive census. Use `^//TEST[:(]`.
