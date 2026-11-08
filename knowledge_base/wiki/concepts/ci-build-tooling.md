---
title: "CI Build Tooling & Workflow Structure"
type: concept
group: ci-tooling
tags: [ci, build, wasm, falcor, workflows, test-silencing, perf, cmake, slang, capability-atoms, doc-regen, cmdline-ref, shallow-clone, submodules, git-provenance]
source_count: 30
---

# CI Build Tooling & Workflow Structure

How the Slang CI build system is structured: workflow files and their scope, the bot's workflow-permission wall, required checks, GPU test silencing with expected-failure lists, DISABLE build-only jobs, the Falcor build/test split, compile-time perf-CI, the check-cmdline-ref consolidation, and build-environment hazards (disk layout, submodule network fetches, release-CI regressions).

> Related pages: [CI Build: Git Checkout Depth & Submodule Pins](ci-build-git-checkout-and-submodule-pins.md) · [CI Build Process Detection and Concurrency](ci-build-process-detection-and-concurrency.md).

## TL;DR

- **`nv-slang-bot[bot]` cannot push `.github/workflows/*.yml`** (no App `workflows` permission; rejected at push time, even on its own branch), and maintainers close cross-fork workaround PRs on security policy. Scope it at triage: ship source/tests/docs, hand the workflow edit up as `git format-patch` or proposed YAML. A review remedy needing a workflow edit is a named-maintainer action and a merge-blocking open question, never a change request to the fixer.
- **A check is "required" by being in `ci.yml`'s `check-ci.needs`**, not by branch protection: add a `pull_request` job that exits 1 and list it in `needs` (a maintainer-applied edit).
- **Draft PRs get no `pull_request` CI**; marking ready runs it. A `workflow_dispatch` classifies only the head commit, so a docs-only or merge-commit head skips the whole matrix and still reads `success`.
- **GPU-test silencing is layered `-expected-failure-list` files**, matched by exact normalized path; an expected failure reclassifies a clean `SLANG_FAIL` but cannot suppress a crash.
- **`-DSLANG_SLANG_LLVM_FLAVOR=DISABLE` jobs are build-only**, so they confirm no slang-test fix.
- **`download-artifact@v4` is attempt-scoped**: `gh run rerun --failed` on a split build/test workflow reports "Artifact not found"; do a full rerun or push.
- **Do not fold `regenerate-cmdline-ref.yml` into `ci.yml`**; its generate/apply split is a fork-security boundary.
- **An advisory CI script gets `continue-on-error: true` on its step**, not only per-probe `|| true`.
- **`ci-examples.sh` grades on exit code only**, and whole-repo `pre-commit` reds can be inherited from a red `main`; check `git diff --name-only origin/main` before owning a lint failure.
- **COMPARE_COMPUTE `filecheck-buffer` tests need `-output-using-type`**, or CI's cpu+llvm backend dumps hex while local gcc dumps decimal.
- **A clean merge of `slang-diagnostics.lua` can still collide on a numeric code** and break every build right after `Generating fiddle/.fiddle.stamp` with no compiler error (CI builds the PR merged with master); renumber above master's max.
- **Before calling a build disk-blocked, `df` the actual build path** (`/workspace/agent` is a separate, larger volume than `/workspace`).
- **Missing release assets on one arch: trace the exact failing command** and bisect the workflow file's own history; macOS configure failures can come from slang-rhi's own `FetchContent` of Vulkan-Headers.
- **nanoclaw `nv-*` sync-PR CI tests the composed state of every `nv-*` branch**, so an owned-set rename breaks every leaf sync PR until the nv-main sync lands.

## Workflow Permission Constraint

`nv-slang-bot[bot]` lacks the GitHub App `workflows` permission, so it cannot add or edit any `.github/workflows/*.yml`; such fixes go to a human maintainer ([workflow-file issues are not bot-actionable](../learnings/1780769352650-ci-workflow-file-issues-github-workflows-are-not-b.md)). The wall recurs in test silencing that needs both a `tests/*.txt` edit and a workflow conditional (the bot lands only the `.txt`, leaving dangling plumbing) ([test-silencing follow-ups](../learnings/1780769333040-reconciling-slang-ci-test-silencing-follow-ups-exp.md)), the check-cmdline-ref consolidation ([check-cmdline-ref consolidation](../learnings/1781310201311-slang-check-cmdline-ref-yml-ci-yml-consolidation-i.md)), and the Falcor split ([Falcor build/test split](../learnings/1780769330979-falcor-ci-build-test-split-slang-11495-approach-c-.md)). When the follow-up targets a contributor's still-open PR, recommend the author amend it in place (they can edit workflows) rather than ship a competing bot PR ([contributor follow-up → plan-only](../learnings/1780769335094-ci-follow-up-issue-filed-by-a-contributor-against-.md)).

**The push rejection is technical; the policy wall is fatal.** A bot can route around the rejection through the `slang-coworkers/slang` fork (its App has `workflows`) and a REST cross-fork PR (`gh api -X POST repos/shader-slang/slang/pulls -f head=slang-coworkers:<branch> ...`; `gh pr create` fails "fork collab can't be granted"), but maintainers close such PRs on security policy. jkwak-work on #11989→PR #12001: *"coworker is not allowed to modify [workflow files] for security reasons. I will run an agent locally."* The rejection is the early tell that the fix is disallowed ([flag before building](../learnings/1783546220222-coworker-bots-may-not-modify-github-workflows-flag.md), [cross-fork PR is policy-closed](../learnings/1783546977853-cross-fork-workflow-file-pr-opens-but-is-policy-cl.md)). So when the change surface is or requires `.github/workflows/**` or `.github/actions/**`, triage marks the verdict maintainer-only and skips the fix cycle, while still verifying, recommending and filing spun-off *code* issues, which are landable (#11989 spun off #12006/#12007); an existing bot PR is annotated maintainer-only with the diff handed over as a comment ([catch at triage](../learnings/1783546996023-workflow-file-changes-are-policy-rejected-for-cowo.md)).

**Plan for it from the start.** The rejection fires at push time even on the bot's own branch (`refusing to allow a GitHub App to create or update workflow ... without workflows permission`) and lands only the non-workflow commits, so keep workflow commits separate to avoid a `git rm` + re-amend round-trip. Push source, tests and docs; hand the workflow change up as `git format-patch` output or proposed YAML in a PR-body `<details>` block, stating it is proposed, not included. Do not build a verification plan on CI steps the bot cannot push (PR #13042's dropped `check-extras-scripts.yml`; #13079) ([deliver a format-patch](../learnings/1790375258801-nv-slang-bot-github-app-cannot-push-changes-under-.md)). Review remedies hit the same wall: on #14194 (2026-11-02) a review asked for an nvcc fixture compiled in `ci-slang-test.yml`, and the push was rejected. The fixer commits the fixture, puts the YAML hunk in the PR explanation comment or a patch file, adds an "Open question (blocks merge)" line to the PR body, and names a maintainer with `workflows` permission; the reviewer does not request changes for a hunk only a human can push ([review remedies too](../learnings/1793648853326-the-slang-coworkers-github-app-cannot-push-github-.md)).

## Making a Slang CI Check "Required"

Branch protection registers one aggregate `ci.yml` job, `check-ci`, whose `needs:` lists every build/test/lint job and fails if any is not `success`. To make a check blocking, write a `pull_request` job that exits 1 on violation and add it to `check-ci.needs` (precedents: `check-cmdline-ref`, `check-capability-atoms-ref`); branch-protection settings do not change. The script change (e.g. an `--enforce` mode under `extras/`) is bot-committable; the `ci.yml` job + `needs` edit is a maintainer-applied diff, noted in the triage `next-action`. `check-inst-version-changes.sh` is advisory because it exits 0 and its poster runs `on: workflow_run` (no PR-head status). Prefer a dedicated cheap job over flipping the "Check Version Constants" build step, whose artifact upload lacks an `always()` guard ([add a job to check-ci.needs](../learnings/1784430693229-making-a-slang-ci-check-required-add-a-job-to-chec.md)).

## Bot Draft PRs and CI

`ci.yml`'s `filter` job is gated `if: github.event_name != 'pull_request' || github.event.pull_request.draft != true`, so on a draft PR `should-run` is never set and every build/test job skips until a human marks it ready, which fires a `draft=false` event and full CI. A `workflow_dispatch` runs `filter` but classifies only the head commit (`BASE=HEAD^1`), so a docs-only or big merge-commit head skips the matrix with a `success` conclusion (see [CI Build Process Detection and Concurrency](ci-build-process-detection-and-concurrency.md)) ([draft PRs get zero CI](../learnings/1781663343829-bot-draft-prs-get-zero-ci-on-shader-slang-slang-fi.md), [docs-only head skips the matrix](../learnings/1794006658553-slang-ci-yml-workflow-dispatch-skips-all-builds-wh.md)).

## GPU Test Silencing and Expected-Failure Lists

`.github/workflows/ci-slang-test.yml` layers cumulative `-expected-failure-list` flags: always `tests/expected-failure-github.txt`; `expected-failure-no-gpu.txt` when `full-gpu-tests != true`; `expected-failure-linux.txt` on Linux; `expected-failure-linux-gpu.txt` on the T4 tier. Linux aarch64 jobs (`test-linux-{debug,release}-gcc-aarch64`, `ubuntu-24.04-arm`, `full-gpu-tests: false`) consume no-gpu.txt; macOS aarch64 is `full-gpu-tests: true` (Metal works). `tools/gfx-unit-test/gfx-test-util.cpp:265-269` does `SLANG_IGNORE_TEST` when `createDevice()` fails, but misses a Vulkan loader with no ICD (the instance creates, `vkEnumeratePhysicalDevices` returns 0, the test fails past the skip), which is why ~24 Vulkan tests are still listed ([how GPU tests are silenced](../learnings/1780769170873-slang-ci-how-gpu-requiring-unit-tests-are-silenced.md)).

A newly failing Vulkan unit test on a no-GPU runner goes in no-gpu.txt under `# Vulkan gfx-unit-tests require a Vulkan-capable GPU`. Cross-check the x86_64 sanitizer job (also no-GPU, also no-gpu.txt) first: if it passes there, the failure is aarch64-specific and no-gpu.txt is over-broad but harmless. `tools/slang-test/options.cpp:~519` matches entries by exact normalized path, so a typo silently fails to match. An expected failure still runs the test and only reclassifies a clean `SLANG_FAIL`; it cannot suppress a worker crash/SIGSEGV ([test-silencing follow-ups](../learnings/1780769333040-reconciling-slang-ci-test-silencing-follow-ups-exp.md)).

## DISABLE-Configured CI Jobs Are Build-Only

`-DSLANG_SLANG_LLVM_FLAVOR=DISABLE` jobs (`cmake-options-build.yml`) stop at the build step, and the x86_64 test tiers consume artifacts shipped with slang-llvm, so nothing exercises the absent-library path; "best confirmed by CI on a DISABLE configuration" is illusory for a slang-test startup fix. The cheap guard is an assertion in the existing DISABLE build job: `./build/*/bin/slang-test -help | grep -q .` ([DISABLE jobs are build-only](../learnings/1780326708945-slang-disable-ci-jobs-are-build-only-no-slang-test.md)).

## Falcor CI Build/Test Split

PR #11495 moves the Slang build in `falcor-test.yml` off the Falcor GPU runner (`[Windows, self-hosted, falcor]`) to the build pool (`[Windows, self-hosted, build]`), handing over via `upload-artifact@v4` → `download-artifact@v4` (`slang-falcor-build-windows-release`). `windows-latest` lacks the CUDA toolkit the build needs (`SLANG_ENABLE_CUDA=1`). LLVM-from-GCS downloads need no GCP auth (public bucket); only the upload on `refs/heads/master` does. `download-artifact@v4` is attempt-scoped, so `gh run rerun --failed` on a test-only failure reports "Artifact not found" in every split workflow (`materialx-test.yml`, `ci-slang-test.yml`, `falcor-test.yml`); recover with a full rerun or an author push ([Falcor split, approach C](../learnings/1780769330979-falcor-ci-build-test-split-slang-11495-approach-c-.md)).

## Compile-Time Perf-CI

Issue #11501 (`.slang-repro` capture/replay perf-CI) overlaps in-flight PR #11485 (`tools/benchmark/perf-suite/`, synthetic stage-stress + MDL/DXR workloads via `slangc -report-perf-benchmark`). Converge by adding `.slang-repro` as a workload kind in #11485 (`slangc -load-repro <file> -report-perf-benchmark`), reusing its `[{name, value, unit}]` schema and two-tier CI. In-tree pieces: `-dump-repro`, `-load-repro`, `-load-repro-directory`, `-extract-repro`, `-report-perf-benchmark`, `-report-downstream-time` (`slang-options.cpp`); runner labels `[Windows, self-hosted, benchmark | perf | regression-test | build]`; workflows `benchmark.yml`, `falcor-compiler-perf-test.yml`, `push-benchmark-results.yml`, `compile-regression-test.yml`; results in `shader-slang/slang-material-modules-benchmark` ([perf-CI overlaps #11485](../learnings/1780769174979-slang-compile-time-perf-ci-11501-overlaps-pr-11485.md)).

## check-cmdline-ref Consolidation

Folding `check-cmdline-ref.yml` into `ci.yml` (#11586) is low-risk: the `build-linux-release-gcc-x86_64` artifact (`slang-tests-linux-x86_64-gcc-release`, 1-day retention) already contains `bin/slangc`, `check-ci` (`ci.yml` ~L298–362) has the `needs:` pattern, and `slangc -help-style markdown` does not depend on build flags; repoint Generate to the artifact's `bin/` plus `chmod +x`. Do NOT touch `regenerate-cmdline-ref.yml`, the `/regenerate-cmdline-ref` comment auto-fix: it is split for fork security (generate runs untrusted PR code without secrets; a separate apply job commits via SLANGBOT_PAT) ([check-cmdline-ref consolidation](../learnings/1781310201311-slang-check-cmdline-ref-yml-ci-yml-consolidation-i.md)).

## Example-Grading and Whole-Repo Lint CI

**`ci-examples.sh` grades on exit code only**: `run_sample()` never scans output, so an example can print `warning[...]`/`error[...]`/`fatal error[...]` and stay green. `reflection-api` swallows a real `error[E36108]` + `fatal error[E40003]` because its `Result` is discarded and `execute()` returns `SLANG_OK`. A diagnostics gate must grep `(warning|error|fatal error)\[...\]`; the skip mechanism (`--skip-file tests/expected-example-failure-github.txt`, regex `<os>:<platform>:<config>:<sample>`) is the allowlist template ([ci-examples.sh exit code only](../learnings/1783471474036-slang-ci-examples-sh-grades-examples-on-exit-code-.md)).

**`slangpy-samples` CI runs `pre-commit --all-files`**, so a red `main` (e.g. `black` reformatting ~8 pre-existing files) reddens a PR touching no Python. Before owning a `github.ci_failed`, find the failing hook and files (`gh run view --log-failed | grep -iE "Failed|reformatted|\.py"`), compare with `git diff --name-only origin/main`, and confirm `main` is red; document inherited debt instead of pulling in unrelated reformatting. Local `black --check` can pass while CI's pinned version fails ([inherited pre-commit failure](../learnings/1783525328477-slangpy-samples-ci-runs-pre-commit-all-files-inher.md)).

## Advisory CI Shell Scripts: `continue-on-error` at the Call Site

For a script that is advisory by construction (every branch exits 0, only `::warning::`), the fix for "it crashed the build" is `continue-on-error: true` on the workflow step: per-probe `|| true` fixes one probe at a time, while `continue-on-error` makes "never gate the build" structural for any failure (new probe, syntax error, segfault, `set -o` change), and the step still shows failed in the UI. Keep the `|| true` edits too, since under `set -euo pipefail` they preserve later checks' warnings. Do not over-build a regression test (an 82-line harness for a 141-line script was dropped in review). The step change is a workflow edit, so the bot ships the `|| true` edits and hands it to a maintainer (#13041 → PR #13042) ([continue-on-error beats `|| true`](../learnings/1789654672103-advisory-ci-shell-scripts-continue-on-error-beats-.md)).

## COMPARE_COMPUTE filecheck-buffer Portability

COMPARE_COMPUTE tests with `filecheck-buffer=CHECK` need `-output-using-type`: without it, CI's LLVM JIT backend (`-api cpu+llvm`) dumps hex words and local gcc/genericcpp dumps decimal. Values > 9 expose it (`30` vs `1E`), so a local `-cpu` pass does not guarantee CI ([use -output-using-type](../learnings/1781271132976-compare-compute-filecheck-buffer-use-output-using-.md)).

## Diagnostic Code Collisions on Master-Merge

A new `source/slang/slang-diagnostics.lua` entry with an explicit numeric code can collide with a code another PR claimed after your base. Git merges the `.lua` cleanly, but the generator fails and every platform build breaks after an "Update branch"/"Merge branch 'master'" commit; check master's max with `git show origin/master:source/slang/slang-diagnostics.lua | grep -oE '\b55[0-9]{3}\b' | sort -n | tail` and renumber above it ([stale-base codes collide](../learnings/1782741439587-diagnostic-enum-codes-picked-against-a-stale-base-.md)). A PR that never merged master breaks too, since CI builds it merged with current master. The signature is every build job (linux/macos/windows/wasm, static-unit-test, sanitizer) failing right after `Generating fiddle/.fiddle.stamp` with no compiler error: on PR #14108, master's #14051 had added 31166 (`unknown-builtin-name`), which the PR also used. On a reviewed PR, `git merge origin/master` (no rebase or force-push), renumber to codes free on master, and rebuild; before pushing new codes on a long-lived PR, check each with `git show origin/master:source/slang/slang-diagnostics.lua | grep -nE '^\s+<code>,'`. There the tests matched message text, so only docs naming the codes changed ([fiddle-stamp death = duplicate code](../learnings/1793986143356-slang-ci-every-job-dying-at-generating-fiddle-fidd.md)). Picking against every open PR, not only master, is on [CI, build, git & coworker ops](misc-f0909b7-ci-build-git-coworker-ops.md).

## Build Volume and Disk Layout

The container has two volumes: `/workspace` → `/dev/vda1` (shared, ~5–6G free) and `/workspace/agent` → `/dev/vdb` (per-agent, ~89G free, holds the clone and build tree). Before declaring a build disk-blocked, run `df -h --output=source,avail,pcent <actual-build-path>`, not bare `df /workspace` ([per-agent build volume is /dev/vdb](../learnings/1780381892104-per-agent-build-volume-is-dev-vdb-workspace-agent-.md)). If `/dev/vdb` is full of sibling worktrees, build out-of-source on `/dev/vda1`: symlink the worktree's `build/` to `/workspace/build-<issue>` and set `TMPDIR=/workspace/build-<issue>/tmp` ([out-of-source build](../learnings/1781568134178-disk-full-build-workaround-out-of-source-build-on-.md)).

## Compiler Triage Caveats for Build/Fix Work

**DescriptorHandle→ConstantBuffer conversion is blocked by a ParameterGroupType guard.** `_coerce` (`slang-check-conversion.cpp:2188-2195`) fails any coercion to a `ParameterGroupType` (`ConstantBufferType : UniformParameterGroupType : ParameterGroupType`) before the constructor-based implicit-conversion search; `RWStructuredBuffer` is not one, so it converts, and that asymmetry is the bug. The generated `__init(DescriptorHandle<ConstantBuffer<T,L>>)` exists (`hlsl.meta.slang:27044`) and lowering works (`:27307`). Fix: carve DescriptorHandle sources out of line 2192, or remove/reorder the guard per its `:2190` TODO ([blocked in _coerce](../learnings/1782145502619-descriptorhandle-to-constantbuffer-implicit-conver.md)).

**Primary-file `using namespace` leaks through `import`**: importers see `Foo`'s members unqualified, but not from an `implementing`/`__include`d file. Primary-file decls sit under the `ModuleDecl` scope, `__include`d files get a separate `FileDecl` scope, and `importModuleIntoScope` re-exports the module scope's direct-child sibling chain. Before proposing a change, grep `tests/` for tests asserting current behavior: `tests/language-feature/namespaces/namespace-using/b.slang` depends on the leak ([`using namespace` leaks](../learnings/1780476462894-slang-primary-file-using-namespace-leaks-through-i.md)).

## Release-CI Failures: Trace the Exact Command; Bisect the Workflow File

A release missing artifacts for one arch/platform is not a transient until the exact failing command says so: moving a CI leg into a no-sudo container can break one arch's assets (a step that needed root) while others stay green ([no-sudo container asymmetry](../learnings/1782845136368-release-asset-asymmetry-from-moving-a-ci-leg-into-.md)). A release run failing at a **Setup**/environment step is almost always a CI-config change: bisect the workflow file's own history, not the source range since the last green run, which mis-blames an innocent PR ([bisect the workflow file](../learnings/1782869849186-release-ci-setup-failures-bisect-the-workflow-file.md)).

## Vendored-Submodule FetchContent Is a Hidden Network Dependency

Slang macOS CI intermittently fails at **CMake configure** downloading Vulkan-Headers, though Slang core vendors them (`external/CMakeLists.txt` `add_subdirectory(vulkan)` → `Vulkan::Headers`). The vendored **slang-rhi** submodule fetches its own copy (`FetchPackage(vulkan_headers URL .../Vulkan-Headers/archive/refs/tags/v1.4.347.zip)`) under `if(SLANG_RHI_ENABLE_VULKAN)`, ON for Darwin, into a separate `slang-rhi-vulkan-headers` target. CI sets no `SLANG_GITHUB_TOKEN`, so the fetch is anonymous and rate-limited per IP, and free macOS runners share NAT'd pools, hence intermittent 403/timeouts. Generally, a submodule that FetchContents a dependency the parent vendors adds a token-less configure-time network dependency. `FETCHCONTENT_SOURCE_DIR_VULKAN_HEADERS=${CMAKE_SOURCE_DIR}/external/vulkan` is unsafe here: slang-rhi needs bfloat16/float8 symbols absent from the vendored headers (VK_HEADER_VERSION 307), so the fetch stays load-bearing until a submodule bump or an `if(NOT TARGET Vulkan::Headers)` reuse. Vulkan-Headers is not SPIRV-Headers ([slang-rhi fetches Vulkan-Headers](../learnings/1783619348986-slang-11985-2nd-cause-slang-rhi-fetchcontent-downl.md)). Read the pin at the committed gitlink, not a stale working tree ([verify pins at the gitlink](../learnings/1783621079268-verify-submodule-pins-at-the-gitlink-not-the-worki.md)).

## Windows CI Crash Dumps Route via the Shared `ci-slang-test.yml`

For #12032 (Windows counterpart of Linux #10812 core-dump capture): Windows GPU test jobs (`test-windows-*-gpu`, self-hosted GCP-T4) run through the shared `ci-slang-test.yml` (default `shell: bash`, no artifact upload), while the Linux capture lives in `ci-slang-test-container.yml` (`ulimit -c`, `/var/cores` bind-mount, "Capture core dump backtraces" `if: always()`) because Linux GPU tests are containerized. Windows needs WER LocalDumps (registry) in the shared file under `if: runner.os == 'Windows'` with a `shell: pwsh` step. Linux uploads only gdb-symbolized backtraces, never raw cores (full process memory), so the issue's `DumpType=2` full-dump + raw upload regresses security. Either symbolize on-runner with `cdb` and upload only `.txt` (needs Debugging Tools + PDBs), or use `DumpType=1` minidumps with a documented caveat; prefer `if: always()` + `if-no-files-found: ignore` over `if: failure()`. As a pure workflow change, the deliverable is a validated `git apply`-able diff in an issue comment ([Windows crash-dump routing](../learnings/1783637017715-slang-12032-windows-ci-crash-dump-routes-via-ci-sl.md)).

## nanoclaw Sync-PR CI Composes All `nv-*` Branches

On `slang-coworkers/nanoclaw`, `ci.yml` tests a sync PR into an `nv-*` base by merging every sibling `nv-*` branch into a composed state. `nv-main` is canonical for the owned set (`src/*`, `.github/**`, `scripts/**`, `container/agent-runner/**`, `docs/**`, config), which auto-resolves to nv-main on conflict; a conflict outside it fails loudly. So renaming or deleting owned-set files breaks every leaf sync PR until the nv-main sync lands: an "ncl tasks control plane" refactor (`insertTask`→`insertTaskRow`, deleted `scheduling/actions.ts`) was on sync-PR heads but not live tips, so each leaf merged live nv-main's pre-refactor `db.ts` + stale `actions.ts` and hit identical tsc errors while the nv-main PR was green. The tell is tsc errors naming files absent from both the PR head and base (they come from a sibling, almost always nv-main). It is not a flake (`gh run rerun --failed` replays the same `github.sha`); merge the nv-main sync PR first, then re-run the leaves. These `github.pr_ready_for_review` webhooks are outside the shader-slang routing table and have no nanoclaw reviewer, so Main handles them ([sync-PR CI composes nv-* branches](../learnings/1783633650284-nanoclaw-sync-pr-ci-composes-all-nv-branches-merge.md)).

---

**Source learnings (30):**
- [Bot App cannot push .github/workflows/](../learnings/1790375258801-nv-slang-bot-github-app-cannot-push-changes-under-.md) — hand up a `git format-patch`.
- [Workflow-edit review remedies are maintainer actions](../learnings/1793648853326-the-slang-coworkers-github-app-cannot-push-github-.md) — #14194.
- [docs-only head commit skips a dispatch's whole matrix, conclusion still success](../learnings/1794006658553-slang-ci-yml-workflow-dispatch-skips-all-builds-wh.md)
- [Required check = job in `check-ci.needs`](../learnings/1784430693229-making-a-slang-ci-check-required-add-a-job-to-chec.md)
- [DISABLE CI jobs are build-only](../learnings/1780326708945-slang-disable-ci-jobs-are-build-only-no-slang-test.md)
- [Silencing GPU tests on no-GPU runners](../learnings/1780769170873-slang-ci-how-gpu-requiring-unit-tests-are-silenced.md)
- [Perf-CI #11501 overlaps PR #11485](../learnings/1780769174979-slang-compile-time-perf-ci-11501-overlaps-pr-11485.md)
- [Falcor build/test split approach C](../learnings/1780769330979-falcor-ci-build-test-split-slang-11495-approach-c-.md)
- [Test-silencing follow-ups; workflows-perm trap](../learnings/1780769333040-reconciling-slang-ci-test-silencing-follow-ups-exp.md)
- [Contributor follow-up on own open PR](../learnings/1780769335094-ci-follow-up-issue-filed-by-a-contributor-against-.md)
- [Workflow-file issues not bot-actionable](../learnings/1780769352650-ci-workflow-file-issues-github-workflows-are-not-b.md)
- [filecheck-buffer: use -output-using-type](../learnings/1781271132976-compare-compute-filecheck-buffer-use-output-using-.md)
- [check-cmdline-ref → ci.yml](../learnings/1781310201311-slang-check-cmdline-ref-yml-ci-yml-consolidation-i.md)
- [Disk-full: out-of-source build](../learnings/1781568134178-disk-full-build-workaround-out-of-source-build-on-.md)
- [Stale-base diagnostic codes collide](../learnings/1782741439587-diagnostic-enum-codes-picked-against-a-stale-base-.md)
- [Fiddle-stamp death = duplicate code (#14108)](../learnings/1793986143356-slang-ci-every-job-dying-at-generating-fiddle-fidd.md)
- [Build volume is /dev/vdb](../learnings/1780381892104-per-agent-build-volume-is-dev-vdb-workspace-agent-.md)
- [DescriptorHandle→ConstantBuffer blocked](../learnings/1782145502619-descriptorhandle-to-constantbuffer-implicit-conver.md)
- [Primary-file `using namespace` leaks](../learnings/1780476462894-slang-primary-file-using-namespace-leaks-through-i.md)
- [No-sudo container release asymmetry](../learnings/1782845136368-release-asset-asymmetry-from-moving-a-ci-leg-into-.md)
- [Release Setup failures: bisect the workflow](../learnings/1782869849186-release-ci-setup-failures-bisect-the-workflow-file.md)
- [Bots may not modify workflows: flag first](../learnings/1783546220222-coworker-bots-may-not-modify-github-workflows-flag.md)
- [Cross-fork workflow PR is policy-closed](../learnings/1783546977853-cross-fork-workflow-file-pr-opens-but-is-policy-cl.md)
- [Workflow changes: catch at triage](../learnings/1783546996023-workflow-file-changes-are-policy-rejected-for-cowo.md)
- [ci-examples.sh grades exit code only](../learnings/1783471474036-slang-ci-examples-sh-grades-examples-on-exit-code-.md)
- [slangpy-samples inherited pre-commit reds](../learnings/1783525328477-slangpy-samples-ci-runs-pre-commit-all-files-inher.md)
- [slang-rhi FetchContent of Vulkan-Headers](../learnings/1783619348986-slang-11985-2nd-cause-slang-rhi-fetchcontent-downl.md)
- [nanoclaw sync-PR CI composes nv-* branches](../learnings/1783633650284-nanoclaw-sync-pr-ci-composes-all-nv-branches-merge.md)
- [Windows CI crash dumps via ci-slang-test.yml](../learnings/1783637017715-slang-12032-windows-ci-crash-dump-routes-via-ci-sl.md)
- [Advisory scripts: continue-on-error](../learnings/1789654672103-advisory-ci-shell-scripts-continue-on-error-beats-.md)
