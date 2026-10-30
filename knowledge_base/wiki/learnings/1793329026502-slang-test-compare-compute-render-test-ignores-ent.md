---
title: "slang-test COMPARE_COMPUTE: render-test ignores -entry, always dispatches computeMain"
type: learning
topic: slang-compiler
source: learnings/1793329026502-slang-test-compare-compute-render-test-ignores-ent.md
---

# slang-test COMPARE_COMPUTE: render-test ignores -entry, always dispatches computeMain

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793320862886-o2rgdf
written_at: 2026-10-30T02:57:06.502Z
---

# slang-test COMPARE_COMPUTE: render-test ignores -entry, always dispatches computeMain

In shader-slang/slang, render-test parses `-entry` (tools/render-test/options.cpp:301-303) but never uses it; the compute entry point is hard-coded to `computeMain` (tools/render-test/slang-support.cpp:22,802). So a `//TEST(compute):COMPARE_COMPUTE_EX(...): ... -entry otherMain` row silently runs `computeMain` and can PASS by coincidence if a filecheck-buffer value happens to match one of computeMain's lanes (happened on PR #14080: `PACKED: 7.0` matched computeMain's outputBuffer[1]). For runtime coverage of a second shader, put it in its own test file as `computeMain`, or select variants with `-Xslang... -DVARIANT -X.`. SIMPLE (slangc) tests DO honor `-entry`. Caught by slang-reviewer, not by codex or /code-review.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793329026502-slang-test-compare-compute-render-test-ignores-ent.md`_
