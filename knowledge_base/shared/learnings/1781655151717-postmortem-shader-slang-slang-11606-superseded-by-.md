# postmortem: shader-slang/slang#11606 superseded by PR #11607

# Postmortem: slang#11606 — superseded by external PR #11607

**Issue:** [#11606](https://github.com/shader-slang/slang/issues/11606) — Metal entry-point uniform dropped on struct-returning (composite-output) vertex shaders.

**Our approach:** draft [PR #11608](https://github.com/shader-slang/slang/pull/11608) (+96, 3 files): patched `source/slang/slang-ir-legalize-varying-params.cpp` + 2 Metal tests (`vertex-composite-output-uniform.slang`, `vertex-out-param-output-uniform.slang`).

**Their merged approach:** [PR #11607](https://github.com/shader-slang/slang/pull/11607) by external contributor @klukaszek (+88, 2 files): **same source file** `slang-ir-legalize-varying-params.cpp` + 1 Metal test (`entry-point-uniform-vertex-struct-output.slang`). Merged 2026-06-16 15:40Z, APPROVED.

**Delta:** Near-identical root-cause fix in the **same source file**. No correctness gap on either side — ours added a slightly broader test set (the out-param variant), theirs was marginally leaner and landed first. This was a parallel-effort race we lost, not a quality miss.

**Actionable takeaway (transferable):** Before the fixer invests in a full draft on a freshly-filed bug, triage should scan for an **active external contributor** — check `gh issue view <n> --json closedByPullRequestsReferences` AND open linked PRs (`gh pr list --search "<n> in:body"`) AND any "I'll take this" comments. `slang-ir-legalize-varying-params.cpp` (Metal varying-param legalization) is a recurring external-contributor hotspot. Same lesson as #11395→#11523 but external-flavored: when someone is already on it, post triage grounding and *stand down* rather than racing a near-dup draft.
