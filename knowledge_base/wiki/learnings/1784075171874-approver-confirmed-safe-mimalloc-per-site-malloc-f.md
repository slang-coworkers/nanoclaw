---
title: "[approver/confirmed-safe] mimalloc per-site malloc/free conversion (StandardAllocator) is safe when alloc/free swap together + zero-copy transfers are callback-identity asserted"
type: learning
topic: review-approval
source: learnings/1784075171874-approver-confirmed-safe-mimalloc-per-site-malloc-f.md
---

# [approver/confirmed-safe] mimalloc per-site malloc/free conversion (StandardAllocator) is safe when alloc/free swap together + zero-copy transfers are callback-identity asserted

**Context:** slang PR #12105 (pdeayton-nv, follow-on to #11925) routed Slang-owned `::malloc`/`::realloc`/`::free` across `source/core/**` through `StandardAllocator`/`AlignedAllocator` (→ `mi_malloc`/`mi_realloc`/`mi_free`/`mi_malloc_aligned` under `SLANG_ENABLE_MIMALLOC`), hoisted the mimalloc dep+define from the `slang` target (PRIVATE `SLANG_MIMALLOC_OVERRIDE_NEW_DELETE`) up to the `core` target (PUBLIC `SLANG_ENABLE_MIMALLOC`), and gave miniz ZIP archives `StandardAllocator`-backed callbacks to enable a zero-copy finalized-buffer transfer. Decision: WOULD_APPROVE (CLEAN); human maintainer jkwak-work APPROVED at the same head — agreement.

**Why it was safe (the checks that cleared the #8419 mixed-allocator hazard class):** The mixed-allocator crash (learning: mimalloc global new/delete override is C++-only; #8419 was Windows-only + execution-only-detectable) is real for exactly this kind of change. What made this one safe, and the specific probes to run on any future allocator-swap PR:
1. **Per-site pairing:** every converted `.cpp` swaps the alloc side AND the free side together — no half-conversion leaving an `mi_malloc`'d buffer freed by system `::free`. Grep each changed file for `::free`/`::malloc`/`::realloc` remnants adjacent to the new `StandardAllocator` calls.
2. **Foreign-allocator buffers keep their own free:** miniz-owned buffers (`mz_free`) and POSIX `realpath()` buffers (`::free(absPath)` in slang-io.cpp) must NOT be routed through the new allocator. Confirm foreign buffers retain their matching free.
3. **Zero-copy ownership transfers are guarded:** the ZIP write→read transition replaced copy+`mz_free` with `m_data.attach(buf)` — guarded by `SLANG_RELEASE_ASSERT` that all three archive callbacks are the Slang ones. A zero-copy `attach`/`detach` of a foreign buffer is the highest-risk spot; require a callback-identity assert or a copy.
4. **`detach()` escape audit:** `ScopedAllocation::detach()` returns a raw buffer the caller must free. Confirm no consumer frees a detached (now-mimalloc'd) buffer with system `::free`. Here `RawBlob::moveCreate` **swaps** the ScopedAllocation into an owned member (freed via the same allocator), so no raw buffer escapes.
5. **Override scope:** `slang-mimalloc.cpp` includes `mimalloc-new-delete.h` = C++ `new`/`delete` operator override ONLY (not C malloc/free). The per-site conversion is what covers C malloc/free — consistent, no reliance on a global C redirect.

**Coverage caveat that is NOT a blocker but worth flagging:** `SLANG_ENABLE_MIMALLOC` defaults ON only on **Windows-MSVC-SHARED-non-ASan**. So green macOS/Linux CI exercises the `::malloc` FALLBACK path, and unit-test `mi_check_owned()` assertions (correctly `#if SLANG_ENABLE_MIMALLOC`-gated) fire only on the Windows lane. The mimalloc path's runtime signal is the Windows `test-slang` CI. Treat that as a test-effectiveness gap (advisory), not a logic defect — the assertion is correctly gated and the path IS exercised on the shipping lane. Do NOT clear such a gap with an unsupported "covered elsewhere" claim (a codex critique corrected exactly that): disposition it as a test-strength limitation on a correctly-gated assertion.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784075171874-approver-confirmed-safe-mimalloc-per-site-malloc-f.md`_
