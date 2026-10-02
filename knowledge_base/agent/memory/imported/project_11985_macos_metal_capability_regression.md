---
name: project_11985_macos_metal_capability_regression
description: "slang#11985 intermittent macOS CI failure. Resolved truth (merged #12009): deterministic per-OS collision — slang-rhi advertises metallib_4_0 on macOS>=26 so Slang emits the metal4.0-only `[[required_threads_per_threadgroup]]` while the downstream compiler was hard-coded -std=metal3.1. ⛔ Two earlier public framings were each half-wrong (original dx inverted the OS direction; the 'macOS-26 runtime race' reconciliation over-corrected). Vulkan-headers sub-cause: the fetch is load-bearing (submodule v1.4.307 too old) — 'Approach A is a no-op' was disproven by build. Closure gated on a maintainer-authored revert of #12075 (bot lacks workflows perm)."
metadata:
  node_type: memory
  type: project
  originSessionId: b63b776f-b15c-43f2-90e2-00d74c7ee891
---

# slang#11985 — intermittent macOS CI failure (Metal cause resolved; closure maintainer-gated)

Filed by maintainer **jkwak-work** (surfaced on bot PR run #11907, the mimalloc chain
[[project_11925_mimalloc_core_parked]]). Triaged as bug/regression, medium/P2, target-emit (Metal) +
capabilities; verdict cmt 4910230625, `regression`+`Metal` labels added. Related: #10560 (feature),
#11973 (same job), [[project_11989_examples_fail_on_warnings]] (spun off from this issue),
[[project_12096_metal4_oscap_macos26_rhi795]].

## Resolved root cause (Metal) — merged #12009, confirmed by instrumentation on macOS 26.4

PR #12009 (merged 2026-07-15T02:46Z, author nv-slang-bot, assignee jhelferty-nv; part of the #11999
re-enable chain [[project_11999_gpu_printing_reenable_parked]]) instrumented `gpu-printing`'s four silent
`return SLANG_FAIL` sites + `IDebugCallback`. The macos-26 CI log then showed verbatim at
`createComputePipeline`: *"'required_threads_per_threadgroup' attribute requires Metal language standard
metal4.0 or higher"*.

1. slang-rhi advertises Metal caps by OS (`metal-device.cpp`): macOS≥26 → `metallib_4_0`; macOS 15 → only
   `metallib_3_2`.
2. Given 4.0, Slang's emitter correctly emits the metal4.0-only attribute (gated `implies(metallib_4_0)`,
   `slang-emit-metal.cpp`).
3. Slang hard-coded the downstream metal compiler to `-std=metal3.1` (`slang-gcc-compiler-util.cpp`) →
   rejected.

**Deterministic per-OS, not a race.** "Flaky" = the `macos-latest` pool mixing macos-15 and the new
macos-26 ("Tahoe") image. **Fix (single source of truth):** derive `-std=metalX.Y` from the target's
metallib cap — new `SemanticVersion metalLanguageVersion` on `DownstreamCompileOptions`, set at code-gen
when `implies(metallib_4_0)`; unset → historical `-std=metal3.1`. #12009 also reverted the #11995
macOS example quarantine. The A1/A2/A4 capability-default fix forms are **moot**. #10592's
`metallib_latest` 3_1→4_0 flip introduced the latent emit-vs-std inconsistency; it was fixed at the
`-std` layer, not by reverting #10592.

### ⛔ Diagnosis history — relay THIS synthesis, never either earlier half

- **Original triager dx (cmt 4910230625):** mechanism ✅ right (metal4.0 attr vs hard-coded 3.1). ❌ Said
  "emitted unconditionally by default" (actually gated on the runtime-advertised cap) and ❌ inverted the
  OS direction ("fails on older Metal" — it fails on *newer* macos-26).
- **jkwak's local agent (cmt 4930650800)** correlated 12+ runs: failures only on macos-26, macos-15 passes.
  Correct data.
- **Reconciliation/retraction (cmt 4930705367):** ✅ right that macos-26 fails and "flaky" = image mix;
  ❌ relabelled it a "driver/runtime race" and abandoned the mechanism. **Over-corrected.** Its one solid
  observation: the original log only showed the attribute error in slang-test unit tests, while
  `gpu-printing` failed with zero output — the attr→gpu-printing link had been *inferred*, not read.
- Lesson: when new evidence contradicts a direction, refine the contradicted part, don't discard the
  mechanism. See [[feedback_verify_regression_claims_at_precision]]. Triager chose not to re-litigate on
  the resolved issue (reasonable).

## Closure gate — revert #12075 (bot-blocked)

jkwak set the precondition (cmt 4961076388) and later asked the bot for the revert PR (cmt 4985755940).
#12075 (jvepsalainen-nv, merged `7cc70648a9`) touches only
`.github/workflows/nightly-slang-coverage-test.yml` (pins coverage-macos → macos-15 as a stopgap). The
revert is safe now, **but nv-slang-bot lacks the `workflows` permission**
[[project_bot_workflows_permission]], so a workflow-only PR is not bot-actionable. Triager (cmt
4985828042) asked a maintainer to click Revert / `git revert 7cc70648a9` and offered the diff. Not
fixer-actionable; triager owns the fixer edge — no double-dispatch
[[feedback_no_double_dispatch_peer_wired]].

## Vulkan-Headers download sub-cause (separate, awaiting jkwak)

jkwak asked (cmt 4927945553) why CMake configure downloads vulkan headers.

- **Cause:** slang-rhi (not core) `FetchPackage(vulkan_headers)` at configure time (fires because
  `SLANG_RHI_HAS_VULKAN` is ON for Darwin) — `external/slang-rhi/CMakeLists.txt:214-216,574-578`. The
  local copy is `external/vulkan/` (Vulkan-Headers), not `external/spirv-headers/`.
- **Intermittency:** CI sets no `SLANG_GITHUB_TOKEN` → anonymous fetch → per-IP rate limit on shared
  runners (code-proven, not repro'd).
- **⛔ "Approach A is a functional no-op" was DISPROVEN by build.** Redirecting
  `FETCHCONTENT_SOURCE_DIR_VULKAN_HEADERS`→`external/vulkan` works (no fetch) but the submodule is
  **v1.4.307**, too old for slang-rhi's Vulkan backend (pin is **v1.4.347** — the earlier "v1.4.318" was
  read from a dirty submodule working tree; verify pins at the gitlink). Missing symbols include
  `VK_KHR_SHADER_BFLOAT16_EXTENSION_NAME`, `VK_EXT_SHADER_FLOAT8_EXTENSION_NAME`. **The fetch is
  load-bearing** — jkwak's "download is expected" (cmt 4928018877) is right.
- Correction posted as a fresh comment retracting the no-op framing (triager cmt 4928199536).
  Recommendation: close working-as-intended; if mitigation wanted → CI `SLANG_GITHUB_TOKEN` +
  cache/retry; a 307→347 submodule bump only on jkwak's ask. Fixer holding branch/worktree
  `fix/issue-11985` / `wt-slang-11985`.

Ops note: dispatch stalled 07-13→07-15 by the triager provider logout
[[project_slang_triager_auth_outage]].
