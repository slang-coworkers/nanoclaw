# SLANG_ASSERT becomes [[assume]] in release — never narrow it on a path with reachable malformed input

## What

In Slang's C++ codebase, `SLANG_ASSERT(X)` is **not** a runtime check in release builds. It is `SLANG_ASSUME(X)`, which expands to `[[assume(X)]]` / `__builtin_assume(static_cast<bool>(X))` / `__assume(static_cast<bool>(X))` depending on toolchain.

Defined in `source/core/slang-common.h`:
- line 365 (debug): `SLANG_ASSERT(VALUE)` calls `_slangAssert(...)` (real runtime check)
- line 372 (release): `#define SLANG_ASSERT(VALUE) SLANG_ASSUME(VALUE)`
- line 337 / 346 / 348 (`SLANG_ASSUME`): `[[assume(X)]]` / `__builtin_assume(...)` / `__assume(...)`

Falsifying an `[[assume]]` is **undefined behaviour** — the optimizer is told the condition holds, and it may delete or reorder code along that path. This is opposite to the intuition that "asserts are debug signal, no-op in release." The lowering is the opposite — release is the dangerous mode.

## Why this matters during review

When tightening an existing `SLANG_ASSERT(simple_invariant)` to a *narrower* invariant `SLANG_ASSERT(invariant_or_specific_exception)`, you are NOT just sharpening a debug check — you are giving the compiler a stronger assumption in release. If any reachable input falsifies the new tighter invariant, you have introduced a release-only UB on a previously-correct (or merely-loud-but-correct) code path.

This is *exactly* the trap PR #11371 fell into. Round 1 suggested narrowing
```cpp
SLANG_ASSERT(m != SpvExecutionModeMax);
```
to
```cpp
SLANG_ASSERT(
    m != SpvExecutionModeMax ||
    (isTessStage && topologyType == OutputTopologyType::Line));
```
to allow a legitimate isoline-Line no-op. The frontend accepts plain `OutputTopologyType::Triangle` on hull (distinct from `TriangleCW`/`TriangleCCW`; `checkOutputTopologyDecoration` validates only `Stage::Mesh`). That input reaches the assert with `m == Max` and `topologyType == Triangle`, falsifying the new invariant → release UB. Round 2 caught it; round-1 reviewer retracted the suggestion.

## How to apply

When reviewing — or writing — a Slang patch that touches `SLANG_ASSERT`:

1. **Treat narrowing as a compiler-assumption change, not a debug-only tighten.** Ask: is there any reachable IR/input that falsifies the new condition?
2. **If the only thing protecting against the false case is a guard *after* the assert,** the guard does NOT undo the UB. The assumption was already consumed.
3. **Prefer one of these alternatives** when narrowing on a path with non-trivial reachability:
   - Delete the assert and rely on the post-assert guard alone (silent no-op on malformed input — usually fine for emit passes that already no-op other malformed cases).
   - Use `SLANG_RELEASE_ASSERT(...)` so release does runtime-check + crash. Strict but loud.
   - Use a defensive `if (!invariant) return;` — no UB, no crash.
   - Move the validation upstream into a frontend checker (e.g., `CheckEntryPointDecorationsContext`) so the emit-pass invariant is genuine. Largest scope.
4. **`if (m != X) ...` is the idiomatic emit-pass pattern in this file** — emit-pass handlers in `slang-emit-spirv.cpp` already silently no-op on missing decorations. The narrowed-assert was the outlier.

## How to verify a `SLANG_ASSERT` predicate before tightening

1. Read `source/slang/slang-ir-entry-point-decorations.h` (or the relevant enum file) for the full enumerator set the IR can carry.
2. Read the corresponding `Check*Context::check*Decoration` in `source/slang/slang-ir-entry-point-decorations.cpp` to see which values the frontend rejects.
3. Anything in (1) minus (2), restricted to the stages this case can be invoked on, is the reachable input set. If your tightened predicate doesn't cover all of it, you have a UB hole.

## When this also matters

Any narrowing of `SLANG_ASSERT` in code that the frontend can reach with malformed-but-accepted input. The trap is not specific to SPIR-V emit; the macro definition is global. `SLANG_ASSERT_FAILURE` and `SLANG_ASSUME` itself have the same property. Only `SLANG_RELEASE_ASSERT` is a runtime check in release.

## Related notes

- Test gap that allowed both #7660 and #11370 to ship: `tests/spirv/hull-shader-outputtopology.slang` did not enable `SLANG_RUN_SPIRV_VALIDATION=1`. CI sets the env var globally (`.github/workflows/ci-slang-test*.yml`), so opting tests in is automatic — but local-dev verification skips it unless you set the env var explicitly.
- `SLANG_ASSERT` env var on Windows controls *runtime* behavior of debug-mode failures (`system` / `debugbreak` / `release-assert-only` / unset → throw); it does NOT change the release-mode `SLANG_ASSUME` lowering.

## Cross-reference

- `source/core/slang-common.h:330-372` — macro definitions.
- shader-slang/slang#11371 (round-1 suggestion that introduced the UB; round-2 reviewer-A bug finding).
- Prior learning `1779437432996-reviewer-a-claude-pr-review-subagents-can-give-inc.md` — Reviewer A flip-flopping across rounds. PR #11371 round 1 → round 2 is an example where the flip-flop was correct (round 1 suggestion was unsafe).
