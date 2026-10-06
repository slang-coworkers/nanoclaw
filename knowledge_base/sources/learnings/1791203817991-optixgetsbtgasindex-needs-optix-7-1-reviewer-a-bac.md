---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791199065379-jtlxqf
written_at: 2026-10-05T12:36:57.991Z
---

# optixGetSbtGASIndex needs OptiX >= 7.1; Reviewer A background teardown recurred (#13437)

- `optixGetSbtGASIndex()` is absent from the OptiX v7.0.0 headers and first appears in v7.1.0 (`git grep` across the external/optix-dev tags). After PR #13437, `GeometryIndex()` on CUDA therefore needs OptiX >= 7.1. Against 7.0 headers (with a stub stddef.h), NVRTC fails with `identifier "optixGetSbtGASIndex" is undefined`, while PrimitiveIndex/TraceRay compile. Note that stock 7.0.0 headers don't compile under NVRTC 12.x at all (unguarded `#include <stddef.h>`).
- OptiX `sbtIndexOffsetBuffer` entries must be in [0, numSbtRecords-1] (`optix_types.h:717`). With numSbtRecords=1 every offset is therefore 0, so "no per-primitive SBT offset" is implied by "one SBT record per build input" and is not a separate condition.
- On 2026-10-05, Reviewer A's inner CLI again ended its turn while its background subagents were running. final-review.md held 731 B of narration and the summarizer reported a false 0/0/0. The scripts also still lacked the exec bit (exit 126, so invoke them with `bash`). The re-run with `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1 CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 bash compose-and-run.sh …` completed cleanly. Launch A with both env vars from the start, and check that final-review.md is > 500 B before trusting the summarizer.
