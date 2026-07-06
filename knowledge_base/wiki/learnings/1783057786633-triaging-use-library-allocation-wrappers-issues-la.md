---
title: "Triaging 'use library allocation wrappers' issues — latent vs live, and caller-owned vs library-owned buffers"
type: learning
topic: misc
source: learnings/1783057786633-triaging-use-library-allocation-wrappers-issues-la.md
---

# Triaging "use library allocation wrappers" issues — latent vs live, and caller-owned vs library-owned buffers

From shader-slang/slang#11924 ("Use miniz allocation wrappers for miniz-owned buffers"), triaged 2026-07-03 at master@f4975a7f8.

**The issue class:** "Slang frees/reallocs a buffer that library X allocated, using `::free`/`::realloc` instead of X's `x_free()` wrapper." In Slang this shows up via `ScopedAllocation` (source/core/slang-blob.h) — a generic malloc/free RAII owner. Its own contract documents "data must be a pointer that was returned from malloc" (slang-blob.h:203), so handing it a foreign (library-owned) buffer violates that contract.

**Two triage checks that decide severity and scope:**

1. **Latent vs live.** An allocator mismatch is only a *live* heap-corruption bug if the library's allocator actually diverges from the CRT. For a vendored lib, check: is `LIB_NO_MALLOC` defined? Is a custom allocator installed at the call sites? For miniz specifically: `external/miniz/miniz.h:146-150` (`MINIZ_NO_MALLOC` default-OFF) and Slang calls `mz_zip_writer_init_heap(archive, 0, 0)` with **no** alloc callbacks → `MZ_MALLOC`≡`::malloc`, `MZ_FREE`≡`::free`. So the code is correct-by-coincidence today; it's a **latent hardening bug** (low/P3), not a live crash. Say this explicitly in the verdict and PR — it reframes the whole fix as future-proofing.

2. **Library-owned vs caller-owned buffer (false-positive filter).** Not every buffer that touches a library API is library-allocated. Distinguish:
   - *Library-owned* (needs the library's free): functions that **return** a heap buffer — e.g. miniz `tdefl_compress_mem_to_heap(...)`, `mz_zip_writer_finalize_heap_archive(&a, &buf, &size)`. These are the real handoffs.
   - *Caller-owned* (correctly `::free`d): the caller `malloc`s its own buffer and passes it as a **destination** the library only fills — e.g. `mz_zip_reader_extract_to_mem(archive, idx, myBuf, size, flags)` where `myBuf` came from `ScopedAllocation::allocateTerminated`. NOT affected — flag it in the memo so the fixer doesn't "fix" it. (In #11924, zip loadFile:495 was exactly this false positive; the reporter's "two ZIP handoffs" were the two `finalize_heap_archive` sites, not the extract site.)

**Recommended fix shape (Approach A):** copy the library buffer into Slang-owned storage (`RawBlob::tryCreate` / `ScopedAllocation::set`) then `x_free()` the original immediately — keeps `ScopedAllocation` a pure malloc/free owner, dissolves any `::realloc` concern, touches only the handoff sites. Zero-copy alternative (pluggable deallocator fn-ptr on ScopedAllocation) exists but modifies a widely-used core class and needs `reallocate()` to assert when a non-default free-fn is set. Note: miniz exports `mz_free(void*)` (drop-in, same signature) but has **no public `mz_realloc`** — so it's a free-side-only change.

**Testing caveat to state in the PR:** when behavior is byte-identical under the default allocator, no meaningful new regression test is possible — validate via existing round-trip coverage (miniz: tools/slang-unit-test/unit-test-compression.cpp, unit-test-file-system.cpp) staying green + inspection. Don't apply `reproduced` — there's no runtime manifestation to reproduce; verify statically at HEAD.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1783057786633-triaging-use-library-allocation-wrappers-issues-la.md`_
