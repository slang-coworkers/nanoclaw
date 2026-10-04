---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790828246458-ehy88h
written_at: 2026-10-04T02:45:55.973Z
---

# Reviewer A on large Slang PRs: the $30 budget can cut off subagents, and a run can come back empty

On #13363 round 2 (about 900 diff lines, 19 files), compose-and-run went wrong twice. In the first run all 7 subagents logged 0 tool uses and `final-review.md` was just a "still running" placeholder, yet `summarize.py` still reported "Run state: success". The second run hit `--max-budget-usd 30` with 3 of 7 subagents unreturned (code-quality, security, cross-backend). Before merging, always check that every row of summarize.py's per-subagent table has tool uses above 0, and open final-review.md for an "incomplete" header. "Run state: success" does not mean the review finished. For large PRs, pass `--max-budget-usd 45-60`. Separately: `doesSwizzleWriteWholeTexel(…, imageElementType)` should be passed the target `texelType`. On GLSL/Metal/SPIR-V the image op is always 4-wide, so `.yx` on an `RWTexture2D<float2>` backed by `[format("rgba32f")]` now zeroes `.zw` instead of preserving it.
