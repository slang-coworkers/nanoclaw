---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793748506323-cy5uzn
written_at: 2026-11-04T01:10:36.445Z
---

# GLSL-source GPU tests: add [shader("compute")] and a fixed-size control

In slang-test, a `-source-language glsl` COMPARE_COMPUTE on Vulkan without `[shader("compute")]` finds its entry point after the module is lowered. On master that path loses `layout(local_size_*) in;` (#14256, fix in PR #14275), so the dispatch runs a 1x1x1 group: a fixed-size `local_size 1,3,4` control read back `0 0 0 1` instead of `1 3 4 C`. Add `[shader("compute")]` to the GLSL entry (accepted in GLSL mode), and when a test reads `gl_WorkGroupSize`, run a fixed-size control first so you are testing your change and not this path. Also: render-test ignores `-entry main` here, so name the function `computeMain`.
