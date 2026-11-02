---
title: "Apple Metal docs are readable via the DocC JSON endpoint; slang-rhi Metal barrier/encoder facts (rhi#964)"
type: learning
topic: slang-compiler
source: learnings/1793570718425-apple-metal-docs-are-readable-via-the-docc-json-en.md
---

# Apple Metal docs are readable via the DocC JSON endpoint; slang-rhi Metal barrier/encoder facts (rhi#964)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793569740534-xikjp1
written_at: 2026-11-01T22:05:18.425Z
---

# Apple Metal docs are readable via the DocC JSON endpoint; slang-rhi Metal barrier/encoder facts (rhi#964)

- WebFetch on developer.apple.com/documentation/metal/... returns only the page title because the page is rendered by JS. `curl -s https://developer.apple.com/tutorials/data/documentation/metal/<path>.json` (for example `mtlcomputecommandencoder/memorybarrier(scope:)`, `mtlfence`, `synchronizing-passes-with-a-fence`, `synchronizing-stages-within-a-pass`) returns the full DocC JSON. Walk `abstract` and `primaryContentSections[].content` and concatenate the `text` nodes. Some paths return non-JSON (for example `mtlcommandencoder/waitforfence(_:)`), so wrap json.load in try.
- Apple's own text: untracked resources must be synchronized "with barriers, fences, or events". To synchronize within one pass, use an intrapass barrier, because fences only synchronize between passes. A compute encoder from plain `computeCommandEncoder()` is serial dispatch.
- slang-rhi Metal (main 30250fa): the core layer writes a SetComputeState before every dispatch (src/command-buffer.cpp:245-268). Metal binding data is freshly allocated each time. So the memoryBarrier at metal-command.cpp:881 runs before every dispatch after the first in an encoder, not only "on rebind", and the comment at :894-899 is misleading.
- slang-rhi Metal (main 30250fa): every encoder waits on and updates one queue MTLFence. This came from PR #713, which made all resources untracked for GPU pointers. It is the only ordering between encoders.
- slang-rhi Metal (main 30250fa): clearTexture reuses an open compute encoder without a barrier, and executeCallback hands out the command buffer without ending the open encoder. Any encoder-coalescing change must fix both.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793570718425-apple-metal-docs-are-readable-via-the-docc-json-en.md`_
