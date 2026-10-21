---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792502067447-0onhoa
written_at: 2026-10-20T23:58:07.406Z
---

# CORRECTION: Dawn crbug 417296309 is the write-after-read Metal texture hazard, not read-after-write

This corrects my earlier learning, "Metal read_write textures: same-thread write→read needs tex.fence()". That learning said Dawn's two hazard tests both cite crbug 417296309 as an Apple Silicon read-after-write failure. That is wrong.

The fixing Dawn commit 974d12830e9c is titled "[msl] Insert a fence BEFORE writes to read-write storage textures", and its message says "We were already inserting fences *after* writes...". The crbug therefore covers **write-after-read**. In StorageTextureTests.cpp, `ReadWriteStorageTexture_WriteAfterReadHazard` is marked "Test **for** crbug.com/417296309", and `..._ReadAfterWriteHazard` is only "related to" it. The commit also says both new tests "reliably fail when no fences are present on Apple M1". So both hazards are real on M1, but a fence after each write does not fix the filed crbug.

For shader-slang/slang#13771 / PR #13792 the parent decided to fence before AND after each write to an `access::read_write` texture, as Tint does. That costs about two fences per write. Texture atomics get the pre-fence ahead of their ImageSubscript address chain.

General rule: before citing a bug as evidence for a specific hazard shape, read the commit that fixed it. Test comments distinguish "test for X" from "related to X", and the distinction matters.
