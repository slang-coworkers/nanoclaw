---
title: "if constexpr does NOT discard branches in a non-template function (dead-code-to-type-checked conversions)"
type: learning
topic: misc
source: learnings/1783059299573-if-constexpr-does-not-discard-branches-in-a-non-te.md
---

# if constexpr does NOT discard branches in a non-template function (dead-code-to-type-checked conversions)

When triaging a request to convert `#if`-guarded dead code into an always-compiled `if constexpr` form (a common "keep it type-checked so it doesn't rot" ask), check whether the enclosing function is a template.

**Rule:** `if constexpr` only *discards* the untaken branch from instantiation inside a **template**. In a **non-template** function, BOTH branches are fully compiled and type-checked regardless of the condition. So "just make it `if constexpr`" is NOT a mechanical flag-flip when the two branches are not both currently compilable.

**Why it matters (concrete, slang #11928):** `source/slang/slang-serialize-ir.cpp` has `#define DIRECT_FROM_FOSSIL 0` guarding a zero-copy IR-deserialize path inside `deserializeFromFlatModule` — a plain (non-template) function. The two branches declare the same local `flat` as *different types* (`Fossilized<FlatInstTable>&` vs `FlatInstTable`) and call different member APIs (`getElementCount()`/`getStableNameOpcode(a.op)` vs `getCount()`/`a.op`). Converting to `if constexpr` therefore requires the currently-untested-to-compile zero-copy path to actually compile side-by-side with the copy path — real engineering, not a toggle. Flag this in triage so the effort estimate and the maintainer decision are honest.

**Two related triage hooks worth reusing:**
1. **Include hygiene when deleting a `#if`-guarded backend:** the guarded branch's `#include` (here `slang-serialize-riff.h`, providing `RIFFSerialWriter`/`RIFFSerialReader`) may *transitively* pull in a header the LIVE path still needs (here `core/slang-riff.h` for `RIFF::Chunk`/`DataChunk`/`BuildCursor`). Deleting the guarded include silently drops the transitive one → pair the deletion with an explicit `#include` of the still-needed header, and build to confirm. Grep the file for which symbols are used *only* inside the dead branches vs. also in the live path before recommending the include change.
2. **Zero-copy read paths trade away validation:** a "deserialize into a struct first" copy path is typically where untrusted-blob `SLANG_RELEASE_ASSERT` hardening lives (size consistency, operand-index bounds, string/blob bounds, recursion-depth caps). A zero-copy/direct-from-mmap alternative bypasses those. When an issue proposes enabling the zero-copy path for perf, surface the perf-vs-untrusted-input-validation tradeoff explicitly — it's usually the crux of the maintainer's decision, not a detail.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1783059299573-if-constexpr-does-not-discard-branches-in-a-non-te.md`_
