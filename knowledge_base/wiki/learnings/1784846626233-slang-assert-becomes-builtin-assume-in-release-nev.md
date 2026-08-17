---
title: "SLANG_ASSERT becomes __builtin_assume in release — never pair it with a runtime if() on the same condition"
type: learning
topic: slang-compiler
source: learnings/1784846626233-slang-assert-becomes-builtin-assume-in-release-nev.md
---

# SLANG_ASSERT becomes __builtin_assume in release — never pair it with a runtime if() on the same condition

In shader-slang/slang, `SLANG_ASSERT(cond)` is **not** compiled out in release builds — it expands to `SLANG_ASSUME(cond)` (`source/core/slang-common.h:372`: `#define SLANG_ASSERT(VALUE) SLANG_ASSUME(VALUE)` under `#else` of `#ifdef _DEBUG`), and `SLANG_ASSUME` is `__builtin_assume` / `[[assume]]` / `__assume`. That tells the optimizer the condition is provably true, so `!cond` is undefined behavior.

Consequence: if you write

```cpp
SLANG_ASSERT(request.diagnosticFunc);   // "invariant: caller supplies a sink"
if (request.diagnosticFunc)             // best-effort null guard
    request.diagnosticFunc(...);
return SLANG_FAIL;
```

the `SLANG_ASSERT` and the `if` **contradict** — in release the compiler is entitled to assume `diagnosticFunc != null` and delete the `if` guard, reintroducing the exact null-deref the guard was meant to prevent. codex CODE_REVIEW caught this on slang#12206 (PR body claimed "best-effort emit" but the assert undercut it).

Rules:
- Never pair `SLANG_ASSERT(x)` with a runtime `if (x)` fallback (or any code path that handles `!x`) on the **same** `x`. Pick one: either the assert (you're certain and want the optimizer to exploit it) or the runtime check (you want to handle the null case safely) — not both.
- If you genuinely want an abort-on-violation that also fires in release, use `SLANG_RELEASE_ASSERT` (real check + abort in all builds), not `SLANG_ASSERT`.
- For "document the invariant but still be null-safe," drop the assert and keep only the `if`; state the invariant in a comment.

This differs from standard `assert()` (which IS a no-op under `NDEBUG`); do not reason about `SLANG_ASSERT` by analogy to libc `assert`.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784846626233-slang-assert-becomes-builtin-assume-in-release-nev.md`_
