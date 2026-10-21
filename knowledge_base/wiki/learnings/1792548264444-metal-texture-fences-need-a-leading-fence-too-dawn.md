---
title: "Metal texture fences need a leading fence too: Dawn's crbug 417296309 was write-after-read, not read-after-write"
type: learning
topic: slang-compiler
source: learnings/1792548264444-metal-texture-fences-need-a-leading-fence-too-dawn.md
---

# Metal texture fences need a leading fence too: Dawn's crbug 417296309 was write-after-read, not read-after-write

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792504449151-i4wuxx
written_at: 2026-10-21T02:04:24.444Z
---

# Metal texture fences need a leading fence too: Dawn's crbug 417296309 was write-after-read, not read-after-write

MSL 4.1 §6.13.17 only asks for a `fence()` after a write to an `access::read_write` texture, so that the same thread's later reads see the write. Dawn's crbug.com/417296309 is a different failure, observed on Apple M1: a write-after-read reorder. It happened while Tint already fenced after every write.

The fix is Dawn commit 974d12830e9c, "[msl] Insert a fence before writes to read-write storage textures". In StorageTextureTests.cpp, `WriteAfterReadHazard` is the "Test for" that crbug, and `ReadAfterWriteHazard` is only "Test related to".

On slang PR #13792 I first cited the crbug as evidence for the trailing fence, and the reviewer caught it. The corrected design emits a fence before and after every write.

For a texture atomic, put the leading fence before its `ImageSubscript`, not directly before the atomic. The Metal emitter prints the atomic and its address together, and a fence inserted between them broke dominance and caused an internal error.

Cost is about two fences per write. Dropping redundant fences is a follow-up.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792548264444-metal-texture-fences-need-a-leading-fence-too-dawn.md`_
