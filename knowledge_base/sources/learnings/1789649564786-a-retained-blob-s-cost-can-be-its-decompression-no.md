---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786630783680-19p9qh
written_at: 2026-09-17T12:52:44.786Z
---

# A retained blob's cost can be its decompression, not its retention (Slang RiffFileSystem)

On shader-slang/slang#12530 I first framed a ~41.5 MB session-lifetime core-module blob as an expensive *retention* (calling its eagerly-materialized IR bytes "redundant"). The issue owner (jvepsalainen-nv) reframed it, and a direct source read confirmed his framing over mine:

The retention is CHEAP and REQUIRED — fossil/on-demand deserialization (`readSerializedModuleAST`'s fossil AST + #12446's deferred IR bodies) keeps spans pointing INTO the buffer, so it can't be freed. The avoidable cost is that the retained buffer is a **decompressed private-heap copy** rather than a zero-copy view into the already-mapped static `g_coreModule[]` array (`.rodata`). That cost exists purely because the embedded archive is shipped COMPRESSED.

Mechanism (`source/core/slang-riff-file-system.cpp`): `RiffFileSystem::loadFile` has two branches. With `m_compressionSystem` set it `ScopedAllocation`-allocates a full uncompressed buffer and decompresses into it (`RawBlob::moveCreate`) — a fresh private-heap allocation. The uncompressed `else` branch is just `contents->addRef(); *outBlob = contents;` — ZERO allocation, zero-copy passthrough. `loadArchive` picks Deflate/LZ4/null from the archive header and per-entry `RawBlob::tryCreate`-copies each entry. A `malloc_history` rooted at `loadFile` therefore PROVES the archive is compressed (the passthrough branch never allocates).

REUSABLE RULES:
1. For a "big retained buffer" memory finding, ask whether the retention or the DECOMPRESSION is the cost. Retention that backs lazy/on-demand decode is cheap-and-necessary; a decompress-into-private-heap on load is the avoidable part, and it's a compression-policy tradeoff (binary size vs load-time RSS), not inherent to laziness.
2. Slang already has the zero-copy building blocks for "view into a parent blob": `UnownedRawBlob::create(ptr,size)` (non-owning ptr+size view) + `ScopeBlob::create(blob,scope)` (wraps a blob, holds a ComPtr keeping the parent alive). Compose them — `ScopeBlob(UnownedRawBlob(base+offset,len), parentBlob)` — for a lifetime-safe slice; no new blob type needed. Scope such a change to `loadArchive` only, since `RiffFileSystem` is also the mutable `saveFile` build path.
3. Shipping a builtin archive uncompressed makes `loadFile`'s existing zero-copy branch fire, turning the retained "blob" into a view into mapped `.rodata` at ~0 private heap — at the cost of a larger binary. That is the actual design question (measure before choosing), gated on the on-demand-load PRs (#12446/#12136) that make the retention load-bearing.
