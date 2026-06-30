---
title: "CI Build Tooling & Workflow Structure"
type: concept
group: ci-tooling
tags: [ci, build, wasm, falcor, workflows, test-silencing, perf, cmake, slang]
source_count: 15
---

# CI Build Tooling & Workflow Structure

Concrete facts about how the Slang CI build system is structured: workflow files and their scope, GPU test silencing with expected-failure lists, DISABLE-build-only jobs, Falcor build/test split, compile-time perf-CI, the check-cmdline-ref consolidation, and the bot's workflow-permission constraint.

## Workflow Permission Constraint

`nv-slang-bot[bot]` does NOT have the GitHub App `workflows` permission and cannot push `.github/workflows/*.yml` files. Any fix that requires editing a CI workflow file must be handed to a human maintainer/contributor ([[wiki/learnings/1780769352650-ci-workflow-file-issues-github-workflows-are-not-b.md]]). This constraint surfaces repeatedly:
- Silencing a test that requires both a `tests/*.txt` edit AND a workflow conditional change — the bot can do the `.txt` part but not the `.yml` change, leaving dangling workflow plumbing ([[wiki/learnings/1780769333040-reconciling-slang-ci-test-silencing-follow-ups-exp.md]]).
- check-cmdline-ref consolidation into `ci.yml` ([[wiki/learnings/1781310201311-slang-check-cmdline-ref-yml-ci-yml-consolidation-i.md]]).
- Falcor CI build/test split ([[wiki/learnings/1780769330979-falcor-ci-build-test-split-slang-11495-approach-c-.md]]).

When a reconciliation is needed on a still-open contributor PR, the clean path is to recommend the author amend their PR in place (they can edit workflows), NOT to ship a competing bot PR ([[wiki/learnings/1780769335094-ci-follow-up-issue-filed-by-a-contributor-against-.md]]).

## GPU Test Silencing and Expected-Failure Lists

`.github/workflows/ci-slang-test.yml` layers multiple cumulative `-expected-failure-list` flags:
- Always: `tests/expected-failure-github.txt`
- When `full-gpu-tests != true`: `tests/expected-failure-no-gpu.txt`
- Linux jobs: `tests/expected-failure-linux.txt`
- T4 GPU tier: `tests/expected-failure-linux-gpu.txt`

Linux aarch64 jobs (`test-linux-{debug,release}-gcc-aarch64`, `runs-on: ubuntu-24.04-arm`, `full-gpu-tests: false`) already consume `expected-failure-no-gpu.txt`. macOS aarch64 is `full-gpu-tests: true` (Metal works) and does NOT consume the no-gpu list ([[wiki/learnings/1780769170873-slang-ci-how-gpu-requiring-unit-tests-are-silenced.md]]).

The established pattern for a newly-failing Vulkan unit test on a no-GPU runner is to add it to `tests/expected-failure-no-gpu.txt` under the `# Vulkan gfx-unit-tests require a Vulkan-capable GPU` block (~24 entries at HEAD). Before filing a test under this block, cross-check the x86_64 sanitizer job (also no-GPU, consumes no-gpu.txt): if the test passes there, the failure is aarch64-Vulkan-environment-specific, not a generic no-GPU condition — no-gpu.txt still works as a placement (harmless no-op on x86_64) but is slightly over-broad ([[wiki/learnings/1780769333040-reconciling-slang-ci-test-silencing-follow-ups-exp.md]]).

**Expected-failure matching mechanics:** `tools/slang-test/options.cpp:~519` matches expected-failure entries against test names by exact normalized path string — a typo silently fails to match and CI stays red. Expected-failure RUNS the test and reclassifies a clean SLANG_FAIL exit as ignored; it CANNOT suppress a test that crashes/SIGSEGVs the worker ([[wiki/learnings/1780769333040-reconciling-slang-ci-test-silencing-follow-ups-exp.md]]).

**Auto-skip is not belt-and-suspenders enough.** `tools/gfx-unit-test/gfx-test-util.cpp:265-269` already does `SLANG_IGNORE_TEST` when `getRHI()->createDevice()` fails. Yet ~24 Vulkan tests are still listed in `expected-failure-no-gpu.txt` — the auto-skip is insufficient when the loader is present but no ICD → instance creates, `vkEnumeratePhysicalDevices` returns 0 → failure past the skip point ([[wiki/learnings/1780769170873-slang-ci-how-gpu-requiring-unit-tests-are-silenced.md]]).

## DISABLE-Configured CI Jobs Are Build-Only

CI jobs configured with `-DSLANG_SLANG_LLVM_FLAVOR=DISABLE` (in `.github/workflows/cmake-options-build.yml`) stop at the build step — they do NOT run `slang-test`. The x86_64 test tiers consume artifacts shipped WITH slang-llvm, so they never exercise the absent-library path either. A PR claiming a slang-test startup/harness fix is "best confirmed by CI on a DISABLE configuration" is making an illusory claim. The cheap, GPU-free guard is to add an assertion to the existing DISABLE build job: `./build/*/bin/slang-test -help | grep -q .` ([[wiki/learnings/1780326708945-slang-disable-ci-jobs-are-build-only-no-slang-test.md]]).

## Falcor CI Build/Test Split

PR #11495 split `falcor-test.yml` so the Slang build moves off the Falcor self-hosted GPU runner (`[Windows, self-hosted, falcor]`) onto the standard build pool (`[Windows, self-hosted, build]`), with artifact handover via `actions/upload-artifact@v4` → `download-artifact@v4` (artifact name `slang-falcor-build-windows-release`). The `windows-latest` free runner (Approach A) was blocked by the hard requirement for CUDA toolkit (`SLANG_ENABLE_CUDA=1`), absent on GitHub-hosted images. LLVM-from-GCS does NOT require GCP auth for downloads — the bucket is publicly readable via plain `curl`; only the upload on `refs/heads/master` needs GCP auth ([[wiki/learnings/1780769330979-falcor-ci-build-test-split-slang-11495-approach-c-.md]]).

**Artifact scoping side effect:** `download-artifact@v4` is attempt-scoped, so `gh run rerun --failed` on a test-only failure will report "Artifact not found." This affects every split workflow in the repo (`materialx-test.yml`, `ci-slang-test.yml`, `falcor-test.yml`). Recovery requires a full rerun or an author push ([[wiki/learnings/1780769330979-falcor-ci-build-test-split-slang-11495-approach-c-.md]]).

## Compile-Time Perf-CI

Issue #11501 requests `.slang-repro` capture/replay perf-CI. In-flight PR #11485 (`tools/benchmark/perf-suite/`) already covers the same goal via synthetic stage-stress + MDL/DXR workloads driven by `slangc -report-perf-benchmark`. The recommended convergence is to fold `.slang-repro` into #11485's framework as an additive workload kind — `slangc -load-repro <file> -report-perf-benchmark` — reusing the same `[{name, value, unit}]` JSON output schema and the two-tier CI design ([[wiki/learnings/1780769174979-slang-compile-time-perf-ci-11501-overlaps-pr-11485.md]]).

Relevant in-tree infrastructure already exists: `-dump-repro`, `-load-repro`, `-load-repro-directory`, `-extract-repro`, `-report-perf-benchmark`, `-report-downstream-time` (all in `source/slang/slang-options.cpp`); self-hosted runner labels `[Windows, self-hosted, benchmark | perf | regression-test | build]`; workflow templates `benchmark.yml`, `falcor-compiler-perf-test.yml`, `push-benchmark-results.yml`, `compile-regression-test.yml`; external results store `shader-slang/slang-material-modules-benchmark` via `push-benchmark-results.yml` ([[wiki/learnings/1780769174979-slang-compile-time-perf-ci-11501-overlaps-pr-11485.md]]).

## check-cmdline-ref Consolidation

`check-cmdline-ref.yml` can be consolidated into `ci.yml` (issue #11586): the `build-linux-release-gcc-x86_64` artifact (`slang-tests-linux-x86_64-gcc-release`, 1-day retention) already contains `bin/slangc`. The `check-ci` job (`ci.yml` ~L298–362) has an existing `needs:` array and failure-condition pattern. The only adjustments needed: repoint the Generate step from `$bin_dir/slangc` (local build tree) to the downloaded artifact's `bin/` + `chmod +x`; and note that `slangc -help-style markdown` output is build-flag-independent ([[wiki/learnings/1781310201311-slang-check-cmdline-ref-yml-ci-yml-consolidation-i.md]]).

**Critical: do NOT touch `regenerate-cmdline-ref.yml`.** It is a separate workflow (the `/regenerate-cmdline-ref` comment auto-fix) with a deliberate fork-security split: generate runs untrusted PR code WITHOUT bot secrets; a separate apply job commits via SLANGBOT_PAT. Folding/deleting it would break the auto-fix path and its security model ([[wiki/learnings/1781310201311-slang-check-cmdline-ref-yml-ci-yml-consolidation-i.md]]).

## Bot Draft PRs and CI

`ci.yml`'s `filter` job is gated `if: github.event_name != 'pull_request' || github.event.pull_request.draft != true`. On a draft PR, `filter` skips, `should-run` is never set, and every build/test job skips. Draft PRs sit with `skipped` CI until a human marks them ready-for-review — the `pull_request` `ready_for_review` event type fires a fresh `draft=false` event, which triggers full CI. `workflow_dispatch` does NOT bypass the filter's draft-gate ([[wiki/learnings/1781663343829-bot-draft-prs-get-zero-ci-on-shader-slang-slang-fi.md]]).

## COMPARE_COMPUTE filecheck-buffer Portability

For COMPARE_COMPUTE tests using `filecheck-buffer=CHECK`, always include `-output-using-type` in the test directive. Without it, the output buffer is dumped as raw hex words by the LLVM JIT backend (`-api cpu+llvm`, used in CI) but as decimal by the gcc/genericcpp backend (used locally). Values > 9 (e.g. `30` vs `1E`) expose the mismatch; values ≤ 9 mask it. A local `-cpu` pass does not guarantee CI ([[wiki/learnings/1781271132976-compare-compute-filecheck-buffer-use-output-using-.md]]).

## Diagnostic Code Collisions on Master-Merge

When you add a new entry to `source/slang/slang-diagnostics.lua` with an explicit numeric code and master advances before your PR merges, another PR can claim the same code. Git auto-merges the `.lua` cleanly (no textual conflict) but the diagnostics code-generator fails, breaking ALL platform `build` jobs uniformly right after a maintainer "Update branch" / "Merge branch 'master'" commit. Diagnosis: `git show origin/master:source/slang/slang-diagnostics.lua | grep -oE '\b55[0-9]{3}\b' | sort -n | tail` to see master's current max; fix by renumbering to the next free code above master's current max ([[wiki/learnings/1782741439587-diagnostic-enum-codes-picked-against-a-stale-base-.md]]).

## Build Volume and Disk Layout

Container disk has two volumes: `/workspace` → `/dev/vda1` (constrained shared host volume, ~5–6G free); `/workspace/agent` → `/dev/vdb` (separate per-agent volume, ~89G free, where the project clone and build tree live). Before declaring a build disk-blocked, run `df -h --output=source,avail,pcent <actual-build-path>` on the build path, not bare `df /workspace` ([[wiki/learnings/1780381892104-per-agent-build-volume-is-dev-vdb-workspace-agent-.md]]). If `/dev/vdb` is full due to many sibling worktrees, build out-of-source onto `/dev/vda1` by symlinking the worktree's `build/` to `/workspace/build-<issue>` and setting `TMPDIR=/workspace/build-<issue>/tmp` ([[wiki/learnings/1781568134178-disk-full-build-workaround-out-of-source-build-on-.md]]).

## Compiler Triage Caveats for Build/Fix Work

**DescriptorHandle→ConstantBuffer implicit conversion blocked by ParameterGroupType guard.** In `source/slang/slang-check-conversion.cpp:2188-2195`, `_coerce` unconditionally fails any coercion whose target is a `ParameterGroupType` (which includes `ConstantBufferType : UniformParameterGroupType : ParameterGroupType`) before the constructor-based implicit-conversion search. `RWStructuredBuffer` is NOT a ParameterGroupType, so it converts fine — that asymmetry is the entire bug. The generated `__init(DescriptorHandle<ConstantBuffer<T,L>>)` is present in the meta-program (`hlsl.meta.slang:27044`) and the lowering path works (`hlsl.meta.slang:27307`) — the guard is the only blocker. Fix direction: carve DescriptorHandle sources out of line 2192 or remove/reorder the guard per its own `:2190` TODO ([[wiki/learnings/1782145502619-descriptorhandle-to-constantbuffer-implicit-conver.md]]).

**Primary-file `using namespace` leaks through `import`.** A `using namespace Foo;` in a module's primary source file is re-exported through `import` (importers see `Foo`'s members unqualified); the same directive in an `implementing`/`__include`d file does NOT leak. The mechanism: primary-file decls are pushed under the `ModuleDecl` scope; `__include`d files get a separate `FileDecl` scope; `importModuleIntoScope` re-exports the module scope's direct-child sibling chain. Before recommending a behavior-changing fix here, grep `tests/` for an existing test that asserts the current behavior — `tests/language-feature/namespaces/namespace-using/b.slang` currently depends on this leak ([[wiki/learnings/1780476462894-slang-primary-file-using-namespace-leaks-through-i.md]]).

---
**Source learnings (15):**
- [[wiki/learnings/1780326708945-slang-disable-ci-jobs-are-build-only-no-slang-test.md]] — DISABLE CI jobs are build-only
- [[wiki/learnings/1780769170873-slang-ci-how-gpu-requiring-unit-tests-are-silenced.md]] — How GPU-requiring unit tests are silenced on no-GPU / aarch64 runners
- [[wiki/learnings/1780769174979-slang-compile-time-perf-ci-11501-overlaps-pr-11485.md]] — Compile-time perf-CI (#11501) overlaps PR #11485
- [[wiki/learnings/1780769330979-falcor-ci-build-test-split-slang-11495-approach-c-.md]] — Falcor CI build/test split approach C
- [[wiki/learnings/1780769333040-reconciling-slang-ci-test-silencing-follow-ups-exp.md]] — Reconciling CI test-silencing follow-ups + workflows-perm coordination trap
- [[wiki/learnings/1780769335094-ci-follow-up-issue-filed-by-a-contributor-against-.md]] — CI follow-up issue by contributor against own still-open PR
- [[wiki/learnings/1780769352650-ci-workflow-file-issues-github-workflows-are-not-b.md]] — CI-workflow-file issues are not bot-actionable
- [[wiki/learnings/1781271132976-compare-compute-filecheck-buffer-use-output-using-.md]] — COMPARE_COMPUTE filecheck-buffer: use -output-using-type
- [[wiki/learnings/1781310201311-slang-check-cmdline-ref-yml-ci-yml-consolidation-i.md]] — check-cmdline-ref.yml → ci.yml consolidation
- [[wiki/learnings/1781568134178-disk-full-build-workaround-out-of-source-build-on-.md]] — Disk-full build workaround: out-of-source build
- [[wiki/learnings/1782741439587-diagnostic-enum-codes-picked-against-a-stale-base-.md]] — Diagnostic/enum codes picked against a stale base collide on master-merge
- [[wiki/learnings/1780381892104-per-agent-build-volume-is-dev-vdb-workspace-agent-.md]] — Per-agent build volume is /dev/vdb (/workspace/agent)
- [[wiki/learnings/1781651810617-a-maintainer-merging-master-into-your-pr-branch-ca.md]] — A maintainer merging master into your PR branch can silently fix the root cause
- [[wiki/learnings/1782145502619-descriptorhandle-to-constantbuffer-implicit-conver.md]] — DescriptorHandle to ConstantBuffer implicit conversion blocked
- [[wiki/learnings/1780476462894-slang-primary-file-using-namespace-leaks-through-i.md]] — Primary-file using namespace leaks through import

_Catalog: [[wiki/index.md]]_
