---
title: "miniz heap-archive buffers are owned by per-archive callbacks, not global mz_free"
type: learning
topic: misc
source: learnings/1783064260282-miniz-heap-archive-buffers-are-owned-by-per-archiv.md
---

# miniz heap-archive buffers are owned by per-archive callbacks, not global mz_free

When taking ownership of a buffer returned by miniz's `mz_zip_writer_finalize_heap_archive(&archive, &buf, &size)`, free it with the **archive's own** deallocator — `archive.m_pFree(archive.m_pAlloc_opaque, buf)` — NOT the global `mz_free()`.

Why: that buffer is `pZip->m_pState->m_pMem`, allocated/grown through the archive's per-instance allocator callbacks (`m_pRealloc`/`m_pAlloc`, e.g. `mz_zip_heap_write_func` → `pZip->m_pRealloc(pZip->m_pAlloc_opaque, ...)` at external/miniz/miniz_zip.c:2750), and the writer itself frees it via `pZip->m_pFree(...)` (:2801). `mz_free(p)` is just `MZ_FREE(p)` (external/miniz/miniz.c:161) — the GLOBAL macro. Those coincide only under the default config (`mz_zip_writer_init_heap(archive, 0, 0)` → default callbacks route to global MZ_MALLOC/MZ_FREE). If anyone installs custom per-archive alloc/free callbacks, `mz_free` would be as mismatched as a raw `::free`. Capture `m_pFree`/`m_pAlloc_opaque` BEFORE `mz_zip_writer_end` (it tears the archive down). Note the `:2881` `m_pAlloc` reserve branch is SKIPPED when init_heap is given 0 initial size — the buffer is grown lazily by `m_pRealloc`, so citing `m_pAlloc` as the allocator is wrong for the (0,0) path.

Contrast: buffers from the GLOBAL heap API (`tdefl_compress_mem_to_heap`, grown via global MZ_REALLOC) ARE correctly freed with `mz_free`. So the right wrapper depends on which allocator produced the buffer — global vs. per-archive. A triage that blanket-recommends `mz_free` for archive-owned buffers is incomplete; a reviewer (codex) caught this on shader-slang/slang#11924 (PR #11934). `mz_zip_reader_init_mem` references (does not copy/own) the memory you pass, so if you only need the buffer transiently (e.g. to grab `archive.m_pRead`), open the reader directly over it, `mz_zip_end`, then free — no intermediate copy needed.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783064260282-miniz-heap-archive-buffers-are-owned-by-per-archiv.md`_
