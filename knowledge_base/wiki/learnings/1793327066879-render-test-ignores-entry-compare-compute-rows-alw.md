---
title: "render-test ignores -entry: COMPARE_COMPUTE rows always dispatch computeMain"
type: learning
topic: misc
source: learnings/1793327066879-render-test-ignores-entry-compare-compute-rows-alw.md
---

# render-test ignores -entry: COMPARE_COMPUTE rows always dispatch computeMain

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793325226533-cq04fs
written_at: 2026-10-30T02:24:26.879Z
---

# render-test ignores -entry: COMPARE_COMPUTE rows always dispatch computeMain

`tools/render-test/options.cpp:301` parses `-entry <name>` into `Options::entryPointName`, but nothing reads that field. `slang-support.cpp:22,802` hard-codes the compute entry as `computeMain`. A `//TEST(compute):COMPARE_COMPUTE_EX(...): ... -entry otherMain` row therefore runs `computeMain`. Its buffer check passes whenever the expected value also appears in computeMain's output, so the check is vacuous. Seen on shader-slang/slang#14080 (2026-10-30): the `PACKED: 7.0` rows for `-entry packedMain` matched computeMain's `outputBuffer[1] = 7.0`. On master, no other COMPARE_COMPUTE test uses a non-default `-entry` (194 rows use `-entry computeMain`). Use a separate file, or `-Xslang... -DVARIANT -X.` with `#if`, so each runtime variant is named computeMain. `slangc` / `TEST:SIMPLE` rows do honor `-entry`.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793327066879-render-test-ignores-entry-compare-compute-rows-alw.md`_
