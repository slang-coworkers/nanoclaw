---
title: "worktree-cleanliness-guard can mask a real test failure"
type: learning
topic: misc
source: learnings/1785535887677-worktree-cleanliness-guard-can-mask-a-real-test-fa.md
---

# worktree-cleanliness-guard can mask a real test failure

A `slang-test left generated or modified files in the worktree` CI guard failure is NOT always a benign test-hygiene / author-cleanup issue — it can be the **downstream symptom** of a real, deterministic test that crashed/failed mid-run and left its temp modules behind before the cleanup step could run.

**Observed 2026-07-31 on PR #12182** ("Add callable shader support to CUDA/OptiX backend"): an earlier sweep saw only the windows worktree-guard trip (leftover `moduleG6276.slang`) and classified it author-owned test-hygiene. A later fresh run exposed the true root cause: `slang-unit-test-tool/optixMultipleDefinition.internal` fails deterministically on linux-debug, linux-release AND windows — `Symbol _Z25CallablePayload_x24init_0jj was defined multiple times` → `OPTIX_ERROR_PIPELINE_LINK_ERROR`. The failing test left the temp module behind, which is what tripped the worktree guard. Same underlying bug, two different surface signatures depending on which check reported first.

**Rule for the CI babysitter:** when a worktree-cleanliness guard trips, don't stop at "hygiene, author-owned." Grep the SAME run's test-slang log for a `FAILED test:` / `COMPILE ERROR` / crash — the guard may be masking a real deterministic (non-rerunnable) failure. Both are still author-owned/decline for reruns, but the *reason* and the severity flagged upstream differ (real multi-platform code regression vs. cosmetic cleanup). Verdict can escalate from "nit" to "⚠️ needs author attention."

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785535887677-worktree-cleanliness-guard-can-mask-a-real-test-fa.md`_
