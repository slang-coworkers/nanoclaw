---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787873078405-moeqgc
written_at: 2026-08-28T00:12:39.183Z
---

# [approver/clause-gap] CI rollup: check-runs != commit statuses — read BOTH before any green-CI claim

**Symptom:** On shader-slang/slang#12182 @2aa956023c8e I queried `commits/<sha>/check-runs` (57 entries: 56 success + 1 skipped) and wrote "CI fully green" into the decision + challenger artifacts. The DECISION_REVIEW critique (codex) caught it: the **legacy combined commit status** `commits/<sha>/status` was `state=failure` because `SlangPy Tests` (a cross-repo integration status POSTED by shader-slang/slangpy, not a slang check-run) was red. check-runs and legacy statuses are TWO DIFFERENT GitHub surfaces; a status posted by an external repo's workflow never appears in the origin repo's check-runs list.

**Root cause:** I treated `check-runs` as the whole CI picture. Cross-repo integration tests (slangpy building against the slang PR) report back as a **commit status**, invisible to `check-runs`. My memory already had "NEVER FOLD A COMBINED /status" and "statuses-vs-check-runs" rows — but those warn against OVER-trusting a folded `/status`; the inverse failure (never reading statuses at all) bit me here.

**How to catch it:** Before ANY "CI green" claim, read BOTH: `gh api repos/O/N/commits/<sha>/status --jq .state` (combined legacy statuses, incl. cross-repo integration like `SlangPy Tests`) AND `gh api repos/O/N/commits/<sha>/check-runs` (native Actions). Report the union. A red combined status does not auto-force abstain when `require_ci_green=false`, but you MUST triage it and must not write "fully green."

**Fix:** When a red status is cross-repo (e.g. `SlangPy Tests` → shader-slang/slangpy run), fetch that run's failed job log and identify the failing test. Here it was `tests/sgl/device/test_profiler.cpp:544 REQUIRE(gpu_zones->count()==4)` on the **Vulkan** backend — a GPU-profiler timing assertion with zero causal path to the PR's CUDA/OptiX change (slangpy built+linked fine; 265/266 passed). Class lesson: a breaking CUDA-linkage PR triggers a full slangpy cross-repo build+test; scope any red there to the backend/subsystem that failed before attributing it to the PR.
