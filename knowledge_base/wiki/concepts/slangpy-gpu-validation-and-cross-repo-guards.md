---
title: "SlangPy GPU Validation and Cross-Repo Guards"
type: concept
group: slangpy
tags: [slangpy, ci, triage, gpu, cuda, vulkan, capability, cross-repo, nvapi, e36121]
source_count: 18
---

# SlangPy GPU Validation and Cross-Repo Guards

How to validate slangpy on the coworker-container GPU (an NVIDIA L40S; confirm with `nvidia-smi -L` each session), read CI-wedge and flake signals, and handle cross-repo breaks between shader-slang/slang and shader-slang/slangpy: `load_program`'s whole-module capability check, the E36121 / `hlsl_nvapi` intended-breaking diagnostic, and the `MatrixLayoutMode` E30015/E30019 version skew.

## TL;DR
- Containers have an NVIDIA L40S (CUDA + NVIDIA Vulkan); 2026-09-28→10-16 was a passthrough outage. Probe `nvidia-smi -L` + a `spy.Device(type=vulkan/cuda)` loop every session before writing "CPU only".
- Differentiable validation: select `spy.DeviceType.cuda` (fwd + `.bwds`, exact gradients). Default `spy.Device()` is Vulkan, whose `bwd_diff` fails `NVVM compilation failed: 1` / error -13 (slangpy-0.43 toolchain, not a migration bug). Module-load compiles on both — the best content-agnostic signal.
- Coop-vector does not run (driver 565.x lacks `VK_NV_cooperative_vector`) but its kernels compile (slangc exit 0), so compile-only checks mislead. NVRTC/CUDA compiles at the first `kernel.dispatch(...)`: dispatch with a real output buffer and expect `RuntimeError`.
- `DEFAULT_DEVICE_TYPES` is `[vulkan, cuda]` on Linux (no `cpu`): zero CPU coverage, and ERROR (not skip) without a GPU. CPU coverage needs a direct `spy.Device(type=cpu)` repro. Measure whether device tests run; don't pre-declare.
- `updatedAt - createdAt` from `gh run list` is not job duration (re-runs keep `created_at`); use `run_started_at`, `run_attempt`, per-job durations. #1070 hangs at `Unit Tests (Python)` after `Unit Tests (C++)` ✓.
- A deliberately crashing test (SIGSEGV/SIGABRT) hangs CI "Unit Tests (Python)" for hours (Crashpad) yet passes locally — hard-guard it on the CI env.
- One test can remove the shared D3D12 device and cascade into hundreds of "Failed to create device!" that look like flake. Grep `RemoveDevice`; the FIRST emitter per xdist worker is the culprit.
- No Python coverage automation (`pytest-cov` never invoked); "84% baseline" is manual. Verify "tests completed" with `git ls-tree -r HEAD` + `gh pr list --search`, not file existence.
- `device.load_program("mod.slang", ["ep"])` capability-checks EVERY `[shader]` EP in the module; one illegal sibling sinks the load. Guard it with SGL-injected `#ifndef __TARGET_CUDA__`.
- `ci-latest-slang.yml` `build-pr` checks out slangpy with no `ref:` (default branch), so a slang PR's required `SlangPy Tests` goes green only after the slangpy fix merges to main. Land the guard first (green no-op on the pin); bump `SGL_SLANG_VERSION` (`external/CMakeLists.txt:85`) at a release tag (slangpy pulls a tarball, not a SHA).
- A slang PR that adds a diagnostic legitimately breaks downstreams that trip it: prove the link in the PR's own diff, route to its author; deterministic ⇒ not rerunnable.
- `0 assertions failed` + N failed cases = module-load/compile break, not a logic regression.
- E36121 iterates only API-requested capabilities (`targetOptionSet.getArray(CompilerOptionName::Capability)`), never declarations — `[__requiresNVAPI]` is not a fix site. Read a diagnostic's emission loop, not its wording.
- All-false `.permissions` on slangpy does not block log reads — probe the operation.
- The `SGL_HAS_NVAPI && d3d12` guard needs both halves (Linux: flag OFF; Windows: ON, vulkan still fails). "Zero d3d12 failures" is decisive only where the fixture enumerates d3d12.
- A/B vs an unreleased Slang PR: `SGL_LOCAL_SLANG_BUILD_DIR` = `build/Release`, never the downloaded release artifact in `build/` (both arms clean = false negative); `strings | grep -c 'is incompatible with compilation target'` must be >0. Baseline the pinned Slang first.
- `MatrixLayoutMode` skew (slang#12986 ↔ slangpy#1135): `E30019` = new slang + old slangpy; `E30015 undefined identifier` = old slang + new slangpy. Same error on ≥3 unrelated PRs = skew → rebase, not a code fix; never force-push an approved PR for it. Check the PR HEAD tree, not `baseRefOid`.

## CI-Triage Signals

**Re-run wall clock.** A re-run keeps the ORIGINAL `created_at` but its jobs start at `run_started_at` (can be ~21h later), so `updatedAt - createdAt` can show 1255 min on a `success` run. Confirm with `gh api .../actions/runs/<id> --jq '{created_at,run_started_at,run_attempt,conclusion}'` and per-job durations. The #1070 hang is step-specific (`Unit Tests (Python)` after `Unit Tests (C++)` ✓), distinct from a job wedged on `Unit Tests (C++)` that hits the same 6h timeout ([SlangPy CI wedge triage: gh run wall-clock false positives and step-level distinction](../learnings/1784742134828-slangpy-ci-wedge-triage-gh-run-wall-clock-false-po.md)).

**Coverage and "completed" claims.** As of 2026-07-22 SlangPy has no Python coverage automation (`pytest-cov` declared, never invoked), so "84% baseline" figures are manual. When a maintainer says tests were "completed", do not assume they are on `main`: on #782 the files lived in unmerged PR #928, caught by `gh pr list --search` + `git ls-tree -r HEAD`. A file-existence check is fooled by untracked leftovers, and a shallow clone breaks `git log --follow` provenance ([SlangPy coverage automation status + verify completed claims vs main not PR branches](../learnings/1784734562681-slangpy-coverage-automation-status-verify-complete.md)).

**D3D12 device-removal cascade.** One test can remove the shared D3D12 device and cascade into hundreds of "Failed to create device!" / "closed command list" failures, indistinguishable from the device-creation infra flake. Grep for `Device removal has been triggered` / `RemoveDevice` and find the test that emits it FIRST per xdist worker: that is the culprit, and later tests on that worker are victims. A spot-check of tests that ran before the poisoner proves nothing. Confirm by re-running with the poisoner skipped. Root cause here: a `shader_resource`-only tensor cleared on D3D12 (see the tensor-clear cluster on the Tensor API page) ([D3D12 device-removal cascade can masquerade as CI infra flake — trace the FIRST failure, not a spot-check](../learnings/1785359117251-d3d12-device-removal-cascade-can-masquerade-as-ci-.md)).

## In-Container GPU Validation: CUDA Works, Vulkan Autodiff Fails

**Measure the GPU each session.** The slangpy-fixer container has a usable NVIDIA L40S (the findings below were measured on it with CUDA 12.7). It was absent only during the 2026-09-28→10-16 host passthrough outage ([operator correction: coworker containers have an NVIDIA L40S](../learnings/1792133264162-coworker-containers-have-an-nvidia-l40s-gpu-cuda-vulkan.md); historical: [no GPU since ~2026-09-28](../learnings/1792089571497-agent-containers-have-no-gpu-since-2026-09-28-host.md)). Probe `nvidia-smi -L` and a `spy.Device(type=...)` loop before claiming either way; skipping it once put a stale "CPU only" caveat on a public verdict ([re-probe the GPU every session](../learnings/1792136253471-slangpy-triage-re-probe-the-gpu-every-session-a-no.md)).

**Backend choice for differentiable validation.** `spy.Device(type=spy.DeviceType.cuda)` runs forward and backward (`.bwds`) correctly: a minimal `RWDiffTensor<float,1>` + `.store` backprop gives the exact gradient. The default `spy.Device()` resolved to Vulkan, whose auto-generated `bwd_diff` kernel fails with `NVVM compilation failed: 1` / `command_encoder->finish ... error -13`. Forward-only Vulkan works. This is a slangpy-0.43 autodiff-on-Vulkan toolchain issue, not a migration defect (the module compiles on both). So select CUDA to validate a differentiable sample; module-load is the strongest content-agnostic signal. Setup: `pip install slangpy` pins 0.43.1 (~92MB, use `--retries 5 --timeout 120`); use `PIL.Image.open` directly (imageio backend discovery is flaky in-container); slangpy-samples images are git-LFS pointers, fetched via the LFS batch API ([slangpy GPU validation in coworker container: CUDA works, Vulkan autodiff fails with NVVM error](../learnings/1785246704737-slangpy-gpu-validation-in-coworker-container-cuda-.md)).

**Device-level tests run.** On slangpy#1155 the SGL device tests (`tests/sgl/device/`, e.g. `test_command_buffer.py`) ran in the container: a from-scratch worktree build ran all 12 green on both Vulkan and CUDA. Measure whether device tests (command encoders, callbacks, dispatch) run rather than pre-declaring it. Keep the portable Python callback-invocation tests as coverage for GPU-less runners, and verify device features end-to-end locally when a device is present ([SGL device tests run on Vulkan + CUDA in the slangpy container — a real NVIDIA L40S is present](../learnings/1789375349943-slangpy-container-has-a-real-nvidia-l40s-gpu-sgl-d.md)).

**`DEFAULT_DEVICE_TYPES` gives no CPU coverage.** `slangpy.testing.helpers.DEFAULT_DEVICE_TYPES` is `[vulkan, cuda]` on Linux, without `DeviceType.cpu`. A test parametrized on it with `should_skip_test_for_device(...)` runs on the GPU but gives zero CPU coverage, and on a GPU-less host it does not skip: it errors at `spy.Device(type=...)` with `RuntimeError: Failed to create device! ... cuInit(0) ... no CUDA-capable device` (environmental, not a regression). Never claim "passes on `DeviceType.cpu`" from such a run; write a direct repro (`spy.Device(type=spy.DeviceType.cpu)` + `Tensor.from_numpy(...)`, a python with numpy, `PYTHONPATH` at the worktree). Companion trap: any follow-up push, even doc-only, re-triggers full CI, so "CI green" holds only for the reviewed commit — scope it so, and re-run OUTPUT_REVIEW after the last PR-body edit (the delivery gate re-hashes attested files at send time) ([SlangPy device tests on a GPU-less container: DEFAULT_DEVICE_TYPES=[vulkan,cuda], no cpu](../learnings/1790186382526-slangpy-device-tests-on-a-gpu-less-linux-container.md)).

## `load_program` Checks the Whole Module; the Guard Can Be a Prerequisite

`device.load_program("mod.slang", ["one_entry_point"])` capability-checks every `[shader]` entry point in the module at load time, not lazily per requested function, so one target-unsupported sibling sinks the load. CI run 30564544350: requesting the CUDA-clean `copy_byte_address_buffer` still tripped `E36107: entrypoint 'copy_buffer_uint' uses features not available for 'cuda'` → `E39999 import failed`. DeepWiki's "lazy per-function" claim is wrong here; trust CI logs. The fix guards the offending EP's whole declaration with the SGL-injected macro `#ifndef __TARGET_CUDA__ … #endif` (injected at `src/sgl/device/shader.cpp:486-496`). The preprocessor removes the EP before the front-end capability check, so it never reaches E36107. Precedent: `src/sgl/device/blit.slang:61-86` ([SlangPy load_program capability-checks ALL entry points in a module at load](../learnings/1785443278231-slangpy-load-program-capability-checks-all-entry-p.md)).

That guard can be the prerequisite that unblocks an upstream slang PR. `SlangPy Tests` is `required=True` on slang PRs, and `ci-latest-slang.yml` builds slang from the PR ref but slangpy from main: its `build-pr` job runs `actions/checkout@v6` with no `ref:`, and `client_payload` sets only the slang ref. So the slang PR cannot merge until the slangpy guard is merged to slangpy main; a draft PR changes nothing (slang#12289 → slangpy#1083; re-confirmed during the E36121 triage below). Do it in two stages. Land the guard now: it is pin-independent, since its own CI uses the pinned release (`external/CMakeLists.txt:85`, `SGL_SLANG_VERSION "2026.12"` then) without the new error, and the offending variant is already `pytest.skip`ped — a green no-op today. Bump `SGL_SLANG_VERSION` in a later PR once the slang fix ships in a release tag, because slangpy pulls a release tarball, not a SHA ([a slangpy test-fixture guard can be the PREREQUISITE that unblocks an upstream slang PR's required check](../learnings/1785478041840-a-slangpy-test-fixture-guard-can-be-the-prerequisi.md)).

## E36121 / `hlsl_nvapi`: an Intended-Breaking Slang Diagnostic

Slang PR #11225 ("Capabilities: error on capabilities incompatible with compilation target", fixes #4422, zangold-nv, `pr: breaking change`) turned its cross-repo `SlangPy Tests` red with 28 identical

```
error[E36121]: requested capability 'hlsl_nvapi' is incompatible with compilation target 'spirv'
error[E39999]: import failed due to compilation error
fatal error[E40003]: compilation ceased
```

on linux-gcc and windows-msvc, on both attempts. `sgl_tests`: 172 passed / 28 failed / 3 skipped, but 0 of 18535 assertions failed and the Slang build was green (`[1450/1450]`). Each failure was a thrown `Failed to load slang module "test" from source`. doctest counts a thrown exception as a failed case while the assertion counter stays clean, so `0 assertions failed` + N failed cases means a module-load break: read the compiler diagnostic. Discriminators ruled out the known buckets: fiddle/GCC-PCH #12227 (no `'friend' used outside of class`; rebased past #12233), Windows `setup-python` toolcache flake (step took 98 ms), `sgl_tests` exit-1 teardown flake (28 real failures), CUDA-OOM #1024 / `test_nested` mismatch (no OOM/numeric markers).

**Verify the causal link in the PR's own diff.** `gh api /repos/shader-slang/slang/pulls/<N>/files --jq '.[].patch'` and grep the code: here it added `36121` + the message in `slang-diagnostics.lua`, the `RequestedCapabilityIncompatibleWithTarget` raise in `slang-target.cpp` (+79/-3), and test `incompatible-capability-for-target.slang` — proof, not correlation. Disposition: legitimate, not rerunnable. Route to the PR author: the question is whether the downstream needs a target-conditional guard landed alongside the break. Permissions: `gh api /repos/shader-slang/slangpy --jq '.permissions'` is all false, yet `/actions/jobs/<id>/logs` returned full 4289-line logs first try — never skip classifying a cross-repo red on the assumption logs are unreachable ([slang capability-error PRs break downstream slangpy via E36121 — an intended cross-repo break](../learnings/1785744645210-slang-capability-error-prs-break-downstream-slangp.md)).

**Read the emission loop before enumerating fix sites.** `TargetRequest::checkCapabilities(DiagnosticSink*)` (`source/slang/slang-target.cpp`, called from `FrontEndCompileRequest::checkEntryPoints` in `slang-check-shader.cpp` for every target) iterates only `targetOptionSet.getArray(CompilerOptionName::Capability)` — the API-level requested list that slangpy fills via `session_options.add(CompilerOptionName::Capability, findCapability("hlsl_nvapi"))`. It never walks declarations, so `[__requiresNVAPI]` at `slangpy/slang/atomics.slang:57` (`public extension half2 : IAtomicAddable`) is not a second fix site; attribute requirements go through use-site capability checking. The message speaks user vocabulary; the loop defines the scope. Notes: `curl -sS https://api.github.com/repos/shader-slang/slang/pulls/11225/files` works unauthenticated; E36121 is declared in the build-time generator `slang-diagnostics.lua`, so grepping `.cpp/.h` for its name finds only `Diagnostics::RequestedCapabilityIncompatibleWithTarget`; `hlsl_nvapi` is `def hlsl_nvapi : hlsl;` in `slang-capabilities.capdef`, so it really is incompatible with spirv, and the PR's GLSL escape hatch (`isGLSLBasedTarget() && cap contains spirv atom → skip`) misses slangpy's vulkan path (`SLANG_SPIRV` + `GENERATE_SPIRV_DIRECTLY`, prints as `spirv`); `-ignore-capabilities` would suppress it, but slangpy does not pass it ([E36121 fires only on explicitly requested capabilities — in-source `[__requiresNVAPI]` is not a second fix site](../learnings/1785750679044-slang-e36121-fires-only-on-explicitly-requested-ca.md)).

### `SGL_HAS_NVAPI` ON/OFF proves both halves of the guard

slangpy's unconditional `hlsl_nvapi` request is at `src/sgl/device/shader.cpp:404-408` (slangpy#1087). The fix guards it with `SGL_HAS_NVAPI && type() == DeviceType::d3d12`. The configure log's `SGL_HAS_NVAPI:` line shows the platforms fail for different reasons:

- `linux-gcc`: `SGL_HAS_NVAPI: OFF` — the nvapi module is never built or linked (`external/CMakeLists.txt:251-259` sets ON only if target `slang-rhi-nvapi` exists), yet the capability is requested → vulkan fails.
- `windows-msvc`: `SGL_HAS_NVAPI: ON` — d3d12 subcases pass (the module is linked); only vulkan fails.

Dropping either half reintroduces one failure mode. `SGL_HAS_NVAPI` is a build-time flag, not a runtime probe. On Windows "zero d3d12 failures" is decisive because `tests/sgl/testing.cpp:73` runs `device_types{d3d12, vulkan}`; confirm the fixture enumerates a target before calling it unaffected — on vulkan-only Linux the same observation proves nothing ([`SGL_HAS_NVAPI` ON/OFF is a natural experiment proving both predicate halves](../learnings/1785745805020-slangpy-hlsl-nvapi-guard-sgl-has-nvapi-on-off-is-a.md)).

### A/B testing a slangpy fix against an UNRELEASED Slang PR

Slangpy `998aeb2` ("Only request hlsl_nvapi capability where the NVAPI Slang module is linked") against Slang at #11225's head `db61cec` (`v2026.14.1-24-gdb61cec`, unmerged):

| variant | doctest tallies | `hlsl_nvapi` | `E36121` |
|---|---|---|---|
| WITHOUT guard | 200 cases, 167 passed, **33 failed** | 28 | 28 |
| WITH guard (`998aeb2`) | 200 cases, 195 passed, **5 failed** | **0** | **0** |
| baseline (pinned Slang 2026.12) | 200 cases, 195 passed, 5 failed | 0 | 0 |

The 5 WITH-guard failures match the baseline byte for byte (3 `test_dds_file.cpp` "DDS file has invalid header", 2 `test_texture_loader.cpp` "Unsupported source image type" — LFS fixtures), so the guard removes exactly the 28 errors. Baseline BEFORE the A/B or you misattribute those 5; 33 = 28 + 5 also falsified a monitor reporting 0 diagnostics.

**False-negative trap.** `slang-11225/build/` holds the real outputs (`build/Release/lib`) and a downloaded release artifact `build/slang-2026.14.1-linux-x86_64{.zip,/}` (fetched for slang-llvm) that lacks #11225. Pointing `-DSGL_LOCAL_SLANG_BUILD_DIR` at it makes both arms clean. Prove the binary has the diagnostic, including the one the test binary loads (slangpy copies the lib):

```bash
strings <dir>/libslang*.so | grep -c 'is incompatible with compilation target'
#   build/Release/lib            -> 2   ✅
#   slang-2026.14.1-*/lib        -> 0   ❌ silently invalidates the A/B
ldd build/linux-gcc/Debug/sgl_tests | grep slang     # then strings THAT path (got 2 ✅)
# cross-check build/Release/include/slang-tag-version.h -> SLANG_TAG_VERSION "2026.14.1-24-gdb61cec"
```

Mechanics ([A/B testing a slangpy fix against an unreleased Slang PR](../learnings/1785747291729-a-b-testing-a-slangpy-fix-against-an-unreleased-sl.md), [PROVEN: the guard fixes slang#11225 E36121 — A/B result and its traps](../learnings/1785750627140-proven-slangpy-hlsl-nvapi-guard-fixes-slang-11225-.md)):

- **Read the clone log before trusting `git log -1`.** During the `fetch pull/N/head` window of a background clone script HEAD still shows `master` (`.git/FETCH_HEAD` exists, `git log FETCH_HEAD` says "ambiguous argument"). Re-check after checkout; prove unmerged with `git merge-base --is-ancestor <pr-head> origin/master`.
- **`git checkout <commit> -- <path>` also stages**, so plain `git diff` is empty; use `git diff HEAD` or `git status --porcelain`. `git reset --hard <commit>` clears both.
- **Slang's `default` preset is Ninja Multi-Config**: `-DCMAKE_BUILD_TYPE=Release` is inert, `cmake --build build --config Release` selects it, and `SGL_LOCAL_SLANG_BUILD_DIR` must be `build/Release` (it reads `lib/libslang-compiler.so` and requires `include/slang-tag-version.h`, else FATAL_ERROR).
- Configure once: `cmake --preset linux-gcc --fresh -DSGL_LOCAL_SLANG=ON -DSGL_LOCAL_SLANG_DIR=<slang> -DSGL_LOCAL_SLANG_BUILD_DIR=build/Release`. Per arm, revert/restore `src/sgl/device/shader.cpp`, `cmake --build --preset linux-gcc-debug` (minutes), `python3 tools/ci.py unit-test-cpp`.
- **Doctest filters can select nothing** (`-tc=formats` / `-sc=vulkan` matched 0, 203 skipped); run the whole binary and grep.
- **Linux exercises the SPIRV path**: `run_gpu_test` is vulkan-only on Linux, and the L40S was present (≤09-22). The real ICD is `/etc/vulkan/icd.d/nvidia_icd.json` (`/usr/share/vulkan/icd.d/` has only intel/radeon/lavapipe); a ctypes `vkCreateInstance` + `vkEnumeratePhysicalDevices` probe proves a GPU without `vulkaninfo`. The ICD is back after the outage. Since `SGL_HAS_NVAPI` is 0 on Linux, a Linux run cannot tell the two guard clauses apart — the Windows `SGL_HAS_NVAPI: ON` leg is load-bearing.

The Python-side counterpart (no GPU, no `sgl_tests`: `slangc`-only build from the PR head, the 2×2 `slangc` differential over generated kernels, CPU noise baselines, why an `import slangpy` failure hides later regressions) is on [SlangPy Validation Against an Unreleased Slang PR](slangpy-validation-against-unreleased-slang.md).

## The MatrixLayoutMode E30015/E30019 Version Skew

E36121 is a new-diagnostic break; this sibling is a pure version skew from a coordinated retype, and its error code flips with merge direction. slang#12986 added the public core-module `enum MatrixLayoutMode` and retyped the `matrix<T,R,C,L>` layout param `int`→`MatrixLayoutMode`; companion slangpy#1135 adapted `slangpy/slang/staticarray.slang:10`. Required `SlangPy Tests` then went red on a cluster of slang PRs: `error[E30015]: undefined identifier 'MatrixLayoutMode'` at `staticarray.slang` → `E39999 import of module 'slangpy' failed` → `tests/sgl/refl/test_lookup.cpp` "Failed to load slang module 'slangpy'" → exit 1. Not a bug, not your PR, not flaky. Since the dispatch (`ci-latest-slang.yml`/`ci-slangpy-trigger-test.yml`) builds the PR's slang against slangpy main:
- NEW slang + OLD slangpy (pre-companion; masked in prod by `SLANGPY_CHERRY_PICK_PR`) → the int→enum mismatch `E30019` the breaking PR documents.
- OLD slang + NEW slangpy (after #1135 merged, every slang PR still BEHIND the breaking commit) → `E30015 undefined identifier`.

Tells: identical E30015 on three unrelated PRs (#12912, #12915, #12910); `gh pr view <n> --json mergeStateStatus` = `BEHIND` on all; `git grep 'enum MatrixLayoutMode' <breaking-commit>^` empty, so the symbol is new and the failing builds are on older slang. Remedy: rebase/merge master into each branch — no code fix, no tracking issue, and `gh run rerun` cannot help. Do NOT rebase an already-approved PR for it (force-push dismisses approval); report the red check as pre-existing and unrelated. Check `SLANGPY_CHERRY_PICK_PR` on slang master (`""` = clean; stale non-empty = cleanup item). `//@hidden:` in `.meta.slang` is docgen-only (MarkupVisibility), not an access modifier — an unmarked decl in `public module core;` is Public, which is why slangpy can name `MatrixLayoutMode` ([undefined identifier 'MatrixLayoutMode' is a pre-existing slang↔slangpy break, not your PR](../learnings/1789151049950-slangpy-tests-undefined-identifier-matrixlayoutmod.md), [E30015 = post-companion-merge skew — rebase, not a code fix](../learnings/1789151691310-matrixlayoutmode-slangpy-tests-e30015-post-compani.md)).

**Verify on the PR HEAD tree, not `baseRefOid`; it is not an IR bug.** `gh pr view --json baseRefOid` is the base branch's current tip, not the fork point, so failing and passing PRs both look `BEHIND` and both seem to "contain" the enum. No-build checks against PR HEAD:
- `git grep -n "enum MatrixLayoutMode" <PR_HEAD> -- source/slang/core.meta.slang` empty ⇒ skew (old branches match only the unrelated C++ enum in `slang-compiler.h`/`-options.h`).
- `git merge-base --is-ancestor 578d571f9e $(git merge-base <PR_HEAD> origin/master)` non-zero ⇒ forked before #12986 (`578d571f9e`). On shallow clones `git merge-base` can spuriously fail; prefer pairwise `--is-ancestor` against the breaking commit.

`undefined identifier` is front-end name resolution, emitted before any IR loads, so no IR-op / `kIROp_` / stable-name change can produce it (appended stable-named ops are serialization-safe; `k_min/maxSupportedModuleVersion` is not numerically enforced). Relabel `needs-rebase` (bucket of #12783/#12992). Confirmed 2026-09-15: #13078 fails (forked at #12913) vs #13071 passes (enum at `core.meta.slang:2298`) ([E30015 MatrixLayoutMode = base skew; verify via HEAD source + true fork point, NOT baseRefOid](../learnings/1789435363606-slangpy-tests-e30015-matrixlayoutmode-base-skew-ve.md), [undefined identifier 'MatrixLayoutMode' is a base-skew signature, not a compiler regression](../learnings/1789436787439-slangpy-tests-undefined-identifier-matrixlayoutmod.md)).

## Supersessions

- **GPU presence.** The "no GPU" atom and the GPU-less framing of the `DEFAULT_DEVICE_TYPES` atom describe the 2026-09-28→10-16 outage; the 2026-10-16 operator correction (containers have an L40S) supersedes that framing. Their durable rules (re-probe; no `cpu` in `DEFAULT_DEVICE_TYPES`) stand.
- **`load_program` laziness.** DeepWiki's "lazy per-function" claim is wrong; CI run 30564544350 shows a whole-module check.

**Source learnings (18):**

- [slangpy triage: re-probe the GPU every session; a 'no GPU' note goes stale](../learnings/1792136253471-slangpy-triage-re-probe-the-gpu-every-session-a-no.md)
- [slang capability-error PRs break downstream slangpy via E36121 (intended break); 0-assertion signature](../learnings/1785744645210-slang-capability-error-prs-break-downstream-slangp.md)
- [`SGL_HAS_NVAPI` ON/OFF proves both halves of the `SGL_HAS_NVAPI && d3d12` guard](../learnings/1785745805020-slangpy-hlsl-nvapi-guard-sgl-has-nvapi-on-off-is-a.md)
- [A/B vs an unreleased Slang PR: `build/Release`, checkout-also-stages, re-read the clone log](../learnings/1785747291729-a-b-testing-a-slangpy-fix-against-an-unreleased-sl.md)
- [PROVEN A/B: guard removes #11225's 28 E36121s (33→5); release artifact gives false negative](../learnings/1785750627140-proven-slangpy-hlsl-nvapi-guard-fixes-slang-11225-.md)
- [E36121 fires only on API-requested capabilities; `[__requiresNVAPI]` is not a fix site](../learnings/1785750679044-slang-e36121-fires-only-on-explicitly-requested-ca.md)
- [in-container validation: CUDA runs fwd+bwd; default Vulkan `.bwds` fails NVVM -13](../learnings/1785246704737-slangpy-gpu-validation-in-coworker-container-cuda-.md)
- [gh run wall-clock unreliable for re-runs; #1070 is step-specific](../learnings/1784742134828-slangpy-ci-wedge-triage-gh-run-wall-clock-false-po.md)
- [no Python coverage automation; verify 'completed' claims against git ls-tree HEAD](../learnings/1784734562681-slangpy-coverage-automation-status-verify-complete.md)
- [D3D12 device-removal cascade masquerades as flake; find the FIRST emitter per worker](../learnings/1785359117251-d3d12-device-removal-cascade-can-masquerade-as-ci-.md)
- [load_program capability-checks ALL entry points; guard with `#ifndef __TARGET_CUDA__`](../learnings/1785443278231-slangpy-load-program-capability-checks-all-entry-p.md)
- [slangpy fixture guard can be the PREREQUISITE for an upstream slang PR's required check](../learnings/1785478041840-a-slangpy-test-fixture-guard-can-be-the-prerequisi.md)
- [undefined identifier 'MatrixLayoutMode' is pre-existing, not your PR; don't rebase approved PRs](../learnings/1789151049950-slangpy-tests-undefined-identifier-matrixlayoutmod.md)
- [MatrixLayoutMode E30015 = post-companion-merge skew; E30019 vs E30015; remedy is rebase](../learnings/1789151691310-matrixlayoutmode-slangpy-tests-e30015-post-compani.md)
- [E30015 base skew: verify via PR HEAD + true fork point, not `baseRefOid`](../learnings/1789435363606-slangpy-tests-e30015-matrixlayoutmode-base-skew-ve.md)
- [undefined identifier 'MatrixLayoutMode' is front-end lookup, never an IR-op change](../learnings/1789436787439-slangpy-tests-undefined-identifier-matrixlayoutmod.md)
- [SGL device tests run on Vulkan + CUDA in the container (L40S, ≤09-22)](../learnings/1789375349943-slangpy-container-has-a-real-nvidia-l40s-gpu-sgl-d.md)
- [operator correction: coworker containers have an NVIDIA L40S](../learnings/1792133264162-coworker-containers-have-an-nvidia-l40s-gpu-cuda-vulkan.md) — containers have a usable L40S; the 09-28→10-16 no-GPU atoms are outage-era history
