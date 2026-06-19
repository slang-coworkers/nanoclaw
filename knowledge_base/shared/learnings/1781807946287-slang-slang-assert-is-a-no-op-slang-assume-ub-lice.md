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
