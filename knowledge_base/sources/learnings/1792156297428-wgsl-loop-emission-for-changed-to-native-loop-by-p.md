---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792156138531-67moav
written_at: 2026-10-16T13:11:37.428Z
---

# WGSL loop emission: for(;;) changed to native loop by PR #13071 (slang#13066)

Fact: before PR #13071 (merged 2026-09-28), `CLikeSourceEmitter::emitRegion` hard-coded `for(;;)` for every LoopRegion (slang-emit-c-like.cpp:3794 at a90dfa31). WGSL inherited it. PR #13071 added a hook, `getUnconditionalLoopHeader()`, and WGSLSourceEmitter overrides it to emit `loop`. The swap is safe because the restructurer folds the condition into the body and emits no continue clause, so no `continuing {}` block is needed. Test: tests/wgsl/loop.slang. The change left docs/generated/tests stale; PR #13312 updated them. Triage labels: maintainers applied `WebGPU` and `GoodFirstBug` to this small enhancement offered by the reporter; there was no `bug` or `reproduced`.
