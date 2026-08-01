---
title: "[approver/challenger] slang-rhi feature gated on unmerged companion Slang PR compiles out in CI — zero-coverage distinct from Metal-SKIP"
type: learning
topic: slang-compiler
source: learnings/1785395617012-approver-challenger-slang-rhi-feature-gated-on-unm.md
---

# [approver/challenger] slang-rhi feature gated on unmerged companion Slang PR compiles out in CI — zero-coverage distinct from Metal-SKIP

**Symptom:** slang-rhi#803 "Add CPU ray query support" (WeakKnight, @2fc21a3569aa) adds a 1120-line CPU acceleration-structure impl + 2 dedicated CPU tests (`cpu-ray-query-triangle-state-machine`, `cpu-ray-query-procedural-state-machine`) + 30 CPU/D3D12 CTS cases. Looks like real CPU-backend coverage, and the prior recall counterweight says "CPU runs headlessly in slang-rhi CI so CPU tests CAN execute" (unlike Metal's paravirtual-SKIP). But in the PR's own merge-gating CI the entire CPU ray-query path — impl AND tests — is **compiled out**, so it has ZERO execution coverage.

**Root cause (two compounding, both CI-invisible):**
1. **ABI dependency in an unmerged companion Slang PR.** The feature is gated behind CMake `SLANG_RHI_ENABLE_CPU_RAY_QUERY`, whose default is `SLANG_RHI_CPU_RAY_QUERY_ABI_AVAILABLE` = ON only if the fetched Slang package ships `prelude/slang-cpp-ray-query.h` (CMakeLists.txt:486-506). That header comes from companion Slang PR **shader-slang/slang#12282, which was OPEN/unmerged**. slang-rhi CI pins Slang release `v2026.12.2` (CMakeLists.txt:150; published 2026-07-01) which predates and lacks the header. ⇒ ABI_AVAILABLE=OFF ⇒ ENABLE_CPU_RAY_QUERY defaults OFF ⇒ `test-cpu-ray-query.cpp` not added to sources (CMakeLists.txt:1150-1153), and the CTS device mask degrades `CPU | D3D12` → `D3D12` only via `#ifdef SLANG_RHI_ENABLE_CPU_RAY_QUERY` (test-ray-query-cts.cpp:1056-1060). The new src/cpu CPU-RQ code also compiles out (PRIVATE define gated).
2. **Fork-PR CI never ran anyway.** Cross-repo fork (WeakKnight/slang-rhi); `ci` + `pre-commit` workflows sit at conclusion `action_required` (awaiting maintainer approval to run). Zero CI execution evidence at head regardless of the gate.

**How to catch it:** For any slang-rhi feature behind a `cmake_dependent_option` whose default hinges on a Slang-package header/ABI (`EXISTS ".../slang-*.h"`), (a) check whether that header ships in the pinned `SLANG_RHI_FETCH_SLANG_VERSION` release — if it only lives in an unmerged companion Slang PR, the feature is `OFF` in CI and its tests are `target_sources`-gated out (compiled out, not merely runtime-SKIPPED); (b) grep the test's `GPU_TEST_CASE`/device-mask macro for an `#ifdef <FEATURE>` that degrades the mask when the feature is off; (c) confirm the workflow actually RAN — fork PRs show `action_required`, not a green/red conclusion. This is a DIFFERENT zero-coverage mode from the Metal paravirtual-SKIP siblings (#800/#801/#802): there the code compiled and the test registered but SKIPPED at runtime; here the code and test are excluded from the build entirely.

**Fix / decision:** Independently reinforces "human must look." (On #803 the deterministic `tier_eligible` size cap fired first — 12,724 LOC > 2000 — so the ledger reason_code is CLAUSE_FAIL:tier_eligible, ABSTAIN_POLICY; but had the PR been under the cap, this compile-out gap is a textbook OPEN_GAP ABSTAIN, not a WOULD_APPROVE, because the new code path is unexecuted in merge-gating CI.) Do NOT let the "CPU runs headlessly" counterweight round up to approve when the CPU path is compiled out via an unmerged-dependency gate.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785395617012-approver-challenger-slang-rhi-feature-gated-on-unm.md`_
