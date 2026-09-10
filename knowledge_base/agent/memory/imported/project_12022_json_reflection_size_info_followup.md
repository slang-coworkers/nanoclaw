---
name: project-12022-json-reflection-size-info-followup
description: "#12022 follow-up — systematic JSON reflection size/alignment info; new PR by slang-fixer, DRAFT+merge operator-gated"
metadata: 
  node_type: memory
  type: project
  originSessionId: c5d24bd5-6d81-4f89-b82c-c725deb6c193
---

**#12022 JSON-reflection size-info follow-up** — tangent-vector (maintainer) requested (2026-07-24, PR #12022 comment 5073725059, real @nv-slang-bot mention → github-post-authorized) a NEW separate PR, not a fix to #12022.

**Spec:** add size info to JSON for every `SlangTypeLayout` per layout unit (parameter category) with non-zero size; +alignment only for `Uniform` (bytes); NO stride (derivable). Every type layout gets a `sizes` key = array of `{kind, value}` (+`alignment` for bytes) — more consistent than the pithy single-unit offset special-case. Refactor `emitReflectionTypeLayoutInfoJSON` → kind-info dispatcher (old switch body) + new size-info subroutine. Share layout-unit spelling code between offset and size printers. Goal: JSON reflection parity with C++ reflection API. Expect large purely-additive churn on reflection-JSON `.expected` outputs (~33 files) — intended.

**Status (07-24):** DRAFT PR **#12225** opened & verified — branch `fix/issue-12022-json-reflection-sizes`, worktree `wt-slang-12022-json-sizes`. +2510/−508 across 41 files (`source/slang/slang-reflection-json.cpp`; 38 modified + 1 new reflection `.expected`; new `tests/reflection/type-layout-sizes.slang`). Extracted shared `getReflectionParameterCategoryName()` (offset & size printers name units identically), split `emitReflectionTypeLayoutInfoJSON` → kind-info dispatcher + `emitReflectionTypeLayoutSizeInfoJSON`, comma-tracker fix. Every `SlangTypeLayout` emits `sizes` array `{kind,value}` (+`alignment` for Uniform bytes, no stride) — matches every spec bullet. 99/99 TEST:REFLECTION pass locally (12 ignored); churn semantically additive (trailing `sizes` per type layout, no field moves). codex critique passed 3 stages (PLAN caught real share-code gap: Uniform offset branch hardcoded "uniform" — fixed). 5-bullet posted #12022 comment 5074415059; `report_pr_created` done. Peer review → slang-reviewer.

**Next:** await slang-reviewer verdict + CI (one failing run = known benign draft priority-yield workflow_dispatch, self-clears). Fixer handling review/CI webhooks on the canonical thread.

**Standing:** DRAFT-only; ready/merge OPERATOR-gated.
