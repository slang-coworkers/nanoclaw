---
title: "Slang: SLANG_ASSERT is a no-op (SLANG_ASSUME/UB-license) in release builds — use SLANG_RELEASE_ASSERT to actually fail loudly"
type: learning
topic: slang-compiler
source: learnings/1781807946287-slang-slang-assert-is-a-no-op-slang-assume-ub-lice.md
---

# Slang: SLANG_ASSERT is a no-op (SLANG_ASSUME/UB-license) in release builds — use SLANG_RELEASE_ASSERT to actually fail loudly

In shader-slang/slang, `SLANG_ASSERT(x)` does NOT check `x` in release builds. Verified at `source/core/slang-common.h:365-372`:

```cpp
#ifdef _DEBUG
#define SLANG_ASSERT(VALUE)  do { if (!(VALUE)) [[unlikely]] ::Slang::handleAssert(...); } while(0)
#else
#define SLANG_ASSERT(VALUE) SLANG_ASSUME(VALUE)   // release: __builtin_assume / [[assume]] / __assume
#endif
```

So in a release build `SLANG_ASSERT(p)` immediately before `p->field` is the OPPOSITE of a guard: it tells the optimizer to *assume* `p != null`, granting undefined-behavior license rather than trapping. Only `SLANG_RELEASE_ASSERT(VALUE)` runs the `if (!(VALUE)) handleAssert(...)` check in ALL build configurations.

**Implication for the CLAUDE.md rule "fail loudly on out-of-contract input":** that rule is satisfied by `SLANG_RELEASE_ASSERT`, NOT `SLANG_ASSERT`. When reviewing or writing code that asserts an invariant *and then relies on it* (e.g. asserting a pointer non-null right before dereferencing it on a path that could theoretically be reached with null), `SLANG_ASSERT` gives you nothing in release — it actively makes a future invariant-violation into release-build UB instead of a diagnosable failure. Recommend `SLANG_RELEASE_ASSERT` for guarding out-of-contract input, or restructure so the value is provably safe (e.g. route only the `.location` field through a null-safe accessor while leaving the independent `.message` unchanged).

**Review heuristic:** when a PR adds `SLANG_ASSERT(ptr)` to "document an invariant" right before a bare `ptr->...` deref, flag whether `SLANG_RELEASE_ASSERT` (fail-loud in all configs) or a null-safe accessor is the intended guard — `SLANG_ASSERT` alone is debug-only. Observed on shader-slang/slang#11661 (CUDA HitAttributes deref): the invariant held so it wasn't a live bug, but the assert provided no release-build protection. This is easy to miss — initial human/codex/clarity review all endorsed the `SLANG_ASSERT` choice; only the correctness reviewer caught the release-macro semantics.

## NARROWING an existing SLANG_ASSERT is a compiler-assumption change (release UB), not a debug-only tighten

Tightening `SLANG_ASSERT(simple_invariant)` to a narrower `SLANG_ASSERT(invariant_or_specific_exception)` gives the compiler a STRONGER `[[assume]]` in release. If any reachable input falsifies the new tighter invariant, you've introduced release-only UB on a path that was previously correct. A guard placed *after* the assert does NOT undo it — the assumption was already consumed.

This is exactly the trap PR #11371 fell into: round 1 suggested narrowing `SLANG_ASSERT(m != SpvExecutionModeMax)` to also allow an isoline-Line no-op, but plain `OutputTopologyType::Triangle` on hull reaches the assert with `m == Max` → falsifies the new invariant → release UB. Round 2 caught it; the round-1 reviewer retracted. (Cross-ref `1779437432996` on Reviewer-A flip-flops — here the flip was correct.)

**How to verify a SLANG_ASSERT predicate before tightening:** (1) read the enum file (e.g. `slang-ir-entry-point-decorations.h`) for the full set the IR can carry; (2) read the frontend `Check*Context::check*Decoration` to see which values it rejects; (3) reachable input = (1) minus (2), restricted to the invocable stages — if your tightened predicate doesn't cover all of it, you have a UB hole.

**Alternatives when narrowing on a reachable path:** delete the assert and rely on the post-assert guard (silent no-op — idiomatic for emit-pass handlers in `slang-emit-spirv.cpp`, which already no-op on missing decorations); use `SLANG_RELEASE_ASSERT` (loud in all configs); use a defensive `if (!invariant) return;`; or move validation upstream into a frontend checker. `SLANG_ASSERT_FAILURE` and `SLANG_ASSUME` share the same release property — only `SLANG_RELEASE_ASSERT` is a runtime check in release. Macro defs: `source/core/slang-common.h:330-372`.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781807946287-slang-slang-assert-is-a-no-op-slang-assume-ub-lice.md`_
