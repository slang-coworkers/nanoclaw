---
title: "SlangPy CI, Triage, Build, and Runtime"
type: concept
group: slangpy
tags: [slangpy, ci, triage, flake, build, runtime, buffer, imodule, version, infra]
source_count: 19
---

# SlangPy CI, Triage, Build, and Runtime

Operational knowledge for working with slangpy's CI system, triaging GitHub issues, understanding runtime/API behavior, and building from source. Covers flake patterns, rerun authority, the slang bundling model, buffer layout gotchas, and the fixer-container build environment.

## CI Flakes and Infra Failures

### Crash Dump Re-symbolization
When triaging a slangpy CI abort whose message is buried under crashpad symbolizer noise (`elf_dynamic_array_reader.h:64 tag not found` spam), the highest-leverage first action is to download the failing run's `crash-reports-${os}-${platform}-${compiler}-${config}` artifact and re-symbolize the `.dmp` locally with full symbols (e.g., `minidump-stackwalk` against a debug build of the same sha).

Slangpy's CI already uploads minidumps via `.github/workflows/ci.yml:228-234` (`Upload Crashpad Reports` step) when the matrix has the `crashpad` flag. The `.dmp` + `.txt` + `.json` files are present in the artifact; what's missing is inline readable output in the job log. The on-the-fly stackwalk in `slangpy/testing/crashpad.py:_postprocess_reports` (~lines 105-145) is shallow, and stderr from the aborting worker gets buried by symbolizer warnings. Only works when `matrix.flags` contains `crashpad`. [slangpy CI flake triage: re-symbolize the existing .dmp before designing fixes](../learnings/1779545587070-slangpy-ci-flake-triage-re-symbolize-the-existing-.md)

### GPU OOM (Shared nvrgfx Runner)
**Signature:** `SlangPy Tests` fails with `cuMemAlloc ... CUDA_ERROR_OUT_OF_MEMORY`, `RuntimeError: Failed to create device!`, and pytest-xdist `replacing crashed worker gwN`. Hundreds of tests fail while thousands pass, spanning unrelated files (test_dtypes, test_buffer, test_reflection2, test_torchintegration). That spread + resource-exhaustion errors = intermittent GPU contention, NOT a code regression.

**Root cause:** the job runs `pytest slangpy/tests -vra -n auto --maxprocesses=4` → up to 4 concurrent workers, each creating CUDA + Vulkan device contexts on ONE shared `nvrgfx` Linux GPU. Reruns re-contend on the same saturated GPU and often re-fail. The real lever is maintainer-side: cap GPU-job concurrency, lower `--maxprocesses`, or add a per-job GPU-memory budget. [SlangPy CI flake: shared nvrgfx GPU runner CUDA OOM](../learnings/1781122096821-slangpy-ci-flake-shared-nvrgfx-gpu-runner-cuda-oom.md)

### cpu-shader-llvm shader.o Build Failure
**Symptom (observed 2026-06-09 on slang PR #11424):** slangpy `ci-latest-slang` `build-pr` jobs fail on both Linux and Windows building the `cpu-shader-llvm` example — the `shader.o` generation step does not mark `FAILED:` but the object is absent at link time. Commit `bbc4b0278` added `set_source_files_properties(... GENERATED TRUE)` to fix a Ninja race; that fix is insufficient: reliably broken 2/2 in slangpy's high-parallelism subproject build.

This looks PR-specific but isn't: other slang PRs were green the same day because their slang head was on older master that didn't build this example at all. As PRs rebase onto current master, they start hitting this. Don't fold an example-CMake/build fix into an unrelated PR; reruns won't help. A PR blocked only by this is "blocked by infra," not unmergeable on its own merits. [SlangPy Tests red = cpu-shader-llvm shader.o build failure (master infra, not your PR)](../learnings/1781008254667-slangpy-tests-red-cpu-shader-llvm-shader-o-build-f.md)

### GPU Memory Leak Claims (#115/#608/#827)
Empirical investigation on an L40S (46GB) with debug layers on found that documented leaks #115 (functional API), #608 (command-encoder), and #827 (torch-interop) do NOT reproduce at current HEAD. The real pytest suite shows VRAM as a STEP FUNCTION — jumps when a heavier test group runs then plateaus flat — not a monotonic climb.

**Conclusion:** the pytest-xdist CUDA-OOM cascade is **peak concurrent VRAM = workers × per-worker high-water-mark** on a VRAM-limited runner, not a runaway leak. Real fixes: right-size runner VRAM, or lower per-worker peak. Distinguish a LEAK (monotonic climb on a repeated identical op) from HIGH-WATER-MARK working set (step-function that plateaus). Reusable probe at `/workspace/agent/leak_probe.py`. [slangpy GPU mem-leak #115/#608 don't reproduce at HEAD; CI OOM is concurrent-peak high-water-mark, not a leak](../learnings/1782324497848-slangpy-gpu-mem-leak-115-608-don-t-reproduce-at-he.md)

Reconfirmed rigorously on #1024 (L40S 46GB): micro-repros of the suspected leak issues (single-process, VRAM sampled per-iter via `nvidia-smi`) were **flat after warm-up** (0 growth over 5k–20k iters), while a real CUDA suite slice with whole-session sampling showed the **step function** — VRAM jumps when a heavier test group runs then holds flat — classic high-water-mark working set (~5GB for one CUDA-only worker). CI's `pytest -n auto --maxprocesses=4` opens CUDA+Vulkan(+D3D12)+torch per worker over the full suite, so peak ≈ 4 × per-worker peak easily exceeds a modest CI GPU and the first failed alloc cascades. Actionable: right-size runner VRAM to ≥ `maxprocesses × per-worker peak` + headroom (zero wall-clock cost); a `--maxprocesses` cut is a wall-clock-costly stopgap maintainers rejected — measure per-worker high-water FIRST. Side finding: Vulkan+CUDA-interop (`enable_cuda_interop`) throws `SLANG_FAIL` on `command_encoder->finish()` on L40S — a functional error adjacent to #929/#823, not a leak ([CI GPU-OOM that passes on rerun is usually peak concurrent VRAM, not a leak](../learnings/1782896626067-ci-gpu-oom-that-passes-on-rerun-is-usually-peak-co.md)).

### SlangPy Tests pre-commit: --all-files trap
slangpy-samples CI (`.github/workflows/pre-commit.yml`) runs `pre-commit run --all-files`. One pre-existing violation anywhere in the tree (e.g., a file missing a trailing newline) reds the `pre-commit` job on EVERY PR, regardless of what that PR touches. Fix is a standalone 1-byte EOF-newline PR off `main`. Verification without GPU: `python3 -m venv /tmp/pcvenv && /tmp/pcvenv/bin/pip install pre-commit`, then `/tmp/pcvenv/bin/pre-commit run end-of-file-fixer --files <f>`. [slangpy-samples CI pre-commit runs --all-files; a single un-newlined file reds every PR](../learnings/1781609083456-slangpy-samples-ci-pre-commit-runs-all-files-a-sin.md)

## Rerun Authority and the 403 Boundary

### SlangPy Tests on slang PRs: bot cannot rerun
When a `shader-slang/slang` PR's only failing check is the cross-repo **SlangPy Tests** job, the actual run lives in `shader-slang/slangpy` (triggered via `repository_dispatch`). `gh run rerun <id> --repo shader-slang/slangpy --failed` returns "Must have admin rights to Repository." This is GitHub's structural behavior: `repository_dispatch`-triggered runs require repo-admin rights to rerun. Distinct from the actions:write gateway 403. [SlangPy Tests failures on slang PRs are not bot-rerunnable (admin-rights boundary)](../learnings/1782166177663-slangpy-tests-failures-on-slang-prs-are-not-bot-re.md)

### The Gateway PAT-routing Collision (RETRACTION context)
An earlier note framed the slangpy rerun block as a "flat permission boundary / babysitter scope gap." That was wrong. The "Must have admin rights to Repository" message is also the surface of the **OneCLI gateway PAT-routing collision**: a read-only nv-slang-bot user PAT shadows the App token (which already has `actions:write`). The 2026-06-17 fix scoped the App-token secret to `/repos/shader-slang/slang/actions/*` only, so slangpy (and slang-rhi) still collide. The correct fix is the operator extending the scoped App-token secret to `/repos/shader-slang/slangpy/actions/*`. Do NOT frame it as "grant slangpy actions:write" — the App already has the scope. [slangpy/slang-rhi rerun 403 is the same gateway collision as slang, not missing actions:write](../learnings/1782152095347-slangpy-slang-rhi-rerun-403-is-the-same-gateway-co.md) [RETRACTION: slangpy downstream rerun block is the gateway collision, NOT a babysitter-authority gap](../learnings/1782159293633-retraction-slangpy-downstream-rerun-block-is-the-g.md) [SlangPy downstream check reruns are blocked for the bot (no slangpy admin)](../learnings/1782159092911-slangpy-downstream-check-reruns-are-blocked-for-th.md)

Until the gateway is extended, a flaky slangpy/slang-rhi check must be rerun by the PR author/maintainer or left to self-recover.

## Issue Triage Patterns

### Check if Already Implemented
When triaging a SlangPy "feature request" that cites file:line pointers, grep the CURRENT checkout for the feature's named symbol BEFORE mapping a solution space. Sub-task issues filed under an umbrella effort frequently lag the code — the umbrella PR closes the sub-task's substance without closing the issue. If the feature is already wired and tested, the verdict is needs-decision, not ready-for-fix. [SlangPy triage: grep the issue's named symbols in HEAD first — the feature may already be shipped](../learnings/1781015340808-slangpy-triage-grep-the-issue-s-named-symbols-in-h.md)

### Stale Line References Signal Possible Merge
When triaging a slangpy GitHub issue citing specific line ranges, first check whether those refs still match the current file. If the file is far shorter/different, that is a staleness signal. Run `gh pr list -R shader-slang/slangpy --state merged --search "<feature keywords>"` filtered to dates after the issue's `createdAt`. [slangpy triage: stale line-refs in an issue signal it may already be implemented — check merged PRs first](../learnings/1781015582617-slangpy-triage-stale-line-refs-in-an-issue-signal-.md)

### CUDA Codegen Issues: Search slang Core First
For any slangpy issue about a missing GPU-codegen capability (texture formats, intrinsics, target-specific behavior), run `gh pr list -R shader-slang/slang --search "<topic>" --state all` BEFORE assuming a slang-rhi patch-handoff or writing a slangpy fix. The fix may already exist in flight in the core compiler. 

Concrete case (#808, "CUDA backend lacks format conversion for surface/texture writes"): CUDA `surf*Dwrite` does raw byte writes; float→normalized/packed-int conversion must be emitted into device code at the write site → only the Slang compiler's CUDA codegen can do it. slang-rhi's `format-conversion.h` pack/unpack are CPU-side only. The fix (shader-slang/slang PR #11090, "CUDA surface format conversion prototype") was already in-flight in core. [slangpy #808 CUDA texture format conversion: fix is upstream slang PR #11090, not slang-rhi](../learnings/1781015966794-slangpy-808-cuda-texture-format-conversion-fix-is-.md)

### Tracking Issues for Collaborator PRs
If an issue is a tracking issue for an already-open collaborator PR, park the fix-forward (do NOT dispatch slang-fixer — a bot PR would duplicate/conflict). Still do everything else: HEAD-verify claims, set Issue Type, post the 5-bullet verdict, and flag whether the linked PRs carry `Closes #N`. [Slang CUDA: __constant__-vs-.param codegen check + slangpy-type repro substitution](../learnings/1782457879561-slang-cuda-constant-vs-param-codegen-check-slangpy.md)

## Runtime and API Behavior

### Python `id()` Does Not Reflect C++ IModule* Identity
When a reporter says "slangpy returns distinct `IModule` instances" and shows Python `id(m)` differing across `session.load_module(...)` calls, do NOT treat that as evidence of a slang-core bug. Slangpy mints a fresh Python wrapper proxy for every `load_module` call even when the underlying C++ `IModule*` is the same. To verify actual C++ behavior, compare `IModule*` pointers directly in a standalone C++ program. `Linkage::loadModule` returns `asExternal(module)` which is just `static_cast<slang::IModule*>(Module*)` — no wrapping. The cache works correctly via `findOrImportModule`. [slangpy Python id() ≠ C++ IModule* identity](../learnings/1779891890025-slangpy-python-id-c-imodule-identity.md)

### `create_buffer` Struct Size is a Silent Footgun
`device.create_buffer(element_count=n, struct_size=K)` allocates exactly `n*K` bytes and NEVER reconciles `K` against the Slang-emitted device-side element stride. The stride that indexes `buffer[i]` in-shader is baked into the compiled backend code by Slang codegen per target. If `struct_size` is smaller than the device stride on some target, you get silent out-of-bounds — the debug layer does NOT catch this. Symptom: correct on one backend, corrupted on another.

**Escape hatch:** use `resource_type_layout=program.reflection.<bufferParam>` instead of `struct_size=`. SlangPy then derives `struct_size = element_type_layout()->stride()` — the per-target reflected stride (`src/sgl/device/resource.cpp:66-91`). This is the only host-side way to get a backend-correct allocation; a hard-coded number is a guess. [SlangPy create_buffer struct_size is a silent backend-layout footgun — use resource_type_layout](../learnings/1780598190908-slangpy-create-buffer-struct-size-is-a-silent-back.md)

### Slang Version: Bundled via SGL_SLANG_VERSION
slangpy bundles Slang by downloading a prebuilt release via CMake FetchContent. The version is set in `slangpy/external/CMakeLists.txt`: `set(SGL_SLANG_VERSION "<ver>" ...)`. slang-rhi reuses slangpy's Slang (`SLANG_RHI_FETCH_SLANG OFF`). To override with a local build: `SGL_LOCAL_SLANG=ON` + `SGL_LOCAL_SLANG_DIR`. Authoritative runtime check: `import slangpy; print(slangpy.SLANG_BUILD_TAG)`. slangpy-samples does NOT pin a Slang version — it runs against whatever installed `slangpy` provides. [slangpy bundles Slang via SGL_SLANG_VERSION; samples don't pin it; runtime check is slangpy.SLANG_BUILD_TAG](../learnings/1781166935218-slangpy-bundles-slang-via-sgl-slang-version-sample.md)

### CUDA Constant vs Param Codegen
A no-GPU discriminator for the CUDA entry-point-args vs `ParameterBlock` lowering: compile two variants with `slangc -target cuda -profile cs_6_0 -entry main` and grep the emitted `.cu`. Entry-point-args land in the `.param` bank — slow serial `ld.param` chain for runtime-indexed resource arrays. `ParameterBlock<CallData>` wrapper emits `extern "C" __constant__ GlobalParams_0 SLANG_globalParams` — fast `ld.const` path. `grep -c '__constant__ SLANG_globalParams' out.cu` is the fast/slow tell.

Note: `RWTensor<T,N>` is a SlangPy type, NOT core Slang — substitute `RWStructuredBuffer<float> bufs[N]` indexed at runtime to reproduce the mechanism standalone. Be explicit that this is a mechanism-only repro if you didn't run the perf benchmark. [Slang CUDA: __constant__-vs-.param codegen check + slangpy-type repro substitution](../learnings/1782457879561-slang-cuda-constant-vs-param-codegen-check-slangpy.md)

## Building SlangPy from Source (Fixer Container)

Building the slangpy native extension on an L40S linux-gcc Ninja Multi-Config box:

- **Needs `python3-dev`/`python3.11-dev`** (admin `install_packages` apt). Without it, CMake `find_package(Python ... Development.Module)` fails. nvcc is NOT required (CUDA backend uses the driver API at runtime).
- **PEP-668:** every `pip install` needs `--break-system-packages`. `python3 tools/ci.py install-slangpy-torch` fails because its internal `pip install wheel` omits the flag — install the torch bridge manually: `pip install --break-system-packages wheel && pip install --break-system-packages --no-build-isolation ./src/slangpy_torch`.
- **After a container rebuild**, the image's pip site-packages reset — reinstall `requirements-dev.txt` with `--break-system-packages`. The `/workspace` worktree persists across rebuild; pip packages do not.
- **Interrupted (ENOSPC) submodule checkout** leaves a gitlink with an empty working tree that `git submodule update --init` skips. Fix: `git submodule update --init --force --recursive`.
- **Build only `slangpy_ext`** (`cmake --build build/linux-gcc --config Release --target slangpy_ext`, ~304 steps) to skip heavy C++ test/example binaries. `build/buildtrees` (vcpkg intermediates) is regenerable — safe to `rm -rf` after configure to reclaim ~765MB. [Building slangpy from source in the fixer container: python3-dev, PEP-668, torch bridge, submodule/ENOSPC gotchas](../learnings/1782324519820-building-slangpy-from-source-in-the-fixer-containe.md)

## Infra / Operations

### Prod Coworker Group Dirs Symlinked to /ephemeral
On prod, the 6 slang/slangpy coworker group dirs (`groups/slang-fixer`, `groups/slang-triager`, `groups/slang-reviewer`, `groups/slangpy-fixer`, `groups/slangpy-triager`, `groups/slangpy-reviewer`) are symlinks into `/ephemeral/prod-groups/<name>` (the 251G `/dev/vdb`), not real dirs on the OS disk. `initGroupFilesystem` follows symlinks via `fs.existsSync`, so symlinked dirs are not re-created on wake. Only untracked, gitignored coworker dirs are safe to symlink — `groups/main/` has a git-tracked file and must remain a real dir. Move only while the group's containers are STOPPED. [Prod's 6 slang/slangpy coworker group dirs are symlinked to /ephemeral](../learnings/1780720000000-prod-coworker-groups-symlinked-to-ephemeral.md)

### Bot Cannot Edit Issue Comments on slangpy-samples
`PATCH` an existing issue comment (even one the bot itself authored) on `shader-slang/slangpy-samples` returns HTTP 403 "Must have admin rights to Repository." `POST` a new comment works. When refreshing a triage/status comment, post a fresh incremental comment carrying only the delta instead of PATCHing. Likely applies to other shader-slang repos the bot writes to with the same token scope — assume edit is unavailable until proven otherwise; design updates as append-only fresh comments. [slangpy-samples: editing bot issue comments 403s ('admin rights') — use fresh comments, not PATCH-in-place](../learnings/1781603959329-slangpy-samples-editing-bot-issue-comments-403s-ad.md)

---
**Source learnings (18):**
- [slangpy CI flake triage: re-symbolize the existing .dmp before designing fixes](../learnings/1779545587070-slangpy-ci-flake-triage-re-symbolize-the-existing-.md)
- [slangpy Python id() ≠ C++ IModule* identity](../learnings/1779891890025-slangpy-python-id-c-imodule-identity.md)
- [SlangPy create_buffer struct_size is a silent backend-layout footgun](../learnings/1780598190908-slangpy-create-buffer-struct-size-is-a-silent-back.md)
- [Prod's 6 slang/slangpy coworker group dirs are symlinked to /ephemeral](../learnings/1780720000000-prod-coworker-groups-symlinked-to-ephemeral.md)
- [SlangPy Tests red = cpu-shader-llvm shader.o build failure (master infra, not your PR)](../learnings/1781008254667-slangpy-tests-red-cpu-shader-llvm-shader-o-build-f.md)
- [SlangPy triage: grep the issue's named symbols in HEAD first — the feature may already be shipped](../learnings/1781015340808-slangpy-triage-grep-the-issue-s-named-symbols-in-h.md)
- [slangpy triage: stale line-refs in an issue signal it may already be implemented — check merged PRs first](../learnings/1781015582617-slangpy-triage-stale-line-refs-in-an-issue-signal-.md)
- [slangpy #808 CUDA texture format conversion: fix is upstream slang PR #11090, not slang-rhi](../learnings/1781015966794-slangpy-808-cuda-texture-format-conversion-fix-is-.md)
- [SlangPy CI flake: shared nvrgfx GPU runner CUDA OOM](../learnings/1781122096821-slangpy-ci-flake-shared-nvrgfx-gpu-runner-cuda-oom.md)
- [slangpy bundles Slang via SGL_SLANG_VERSION; samples don't pin it; runtime check is slangpy.SLANG_BUILD_TAG](../learnings/1781166935218-slangpy-bundles-slang-via-sgl-slang-version-sample.md)
- [slangpy-samples: editing bot issue comments 403s — use fresh comments, not PATCH-in-place](../learnings/1781603959329-slangpy-samples-editing-bot-issue-comments-403s-ad.md)
- [slangpy/slang-rhi rerun 403 is the same gateway collision as slang, not missing actions:write](../learnings/1782152095347-slangpy-slang-rhi-rerun-403-is-the-same-gateway-co.md)
- [SlangPy downstream check reruns are blocked for the bot (no slangpy admin)](../learnings/1782159092911-slangpy-downstream-check-reruns-are-blocked-for-th.md)
- [RETRACTION: slangpy downstream rerun block is the gateway collision, NOT a babysitter-authority gap](../learnings/1782159293633-retraction-slangpy-downstream-rerun-block-is-the-g.md)
- [SlangPy Tests failures on slang PRs are not bot-rerunnable (admin-rights boundary)](../learnings/1782166177663-slangpy-tests-failures-on-slang-prs-are-not-bot-re.md)
- [slangpy GPU mem-leak #115/#608 don't reproduce at HEAD; CI OOM is concurrent-peak high-water-mark, not a leak](../learnings/1782324497848-slangpy-gpu-mem-leak-115-608-don-t-reproduce-at-he.md)
- [Building slangpy from source in the fixer container: python3-dev, PEP-668, torch bridge, submodule/ENOSPC gotchas](../learnings/1782324519820-building-slangpy-from-source-in-the-fixer-containe.md)
- [Slang CUDA: __constant__-vs-.param codegen check + slangpy-type repro substitution](../learnings/1782457879561-slang-cuda-constant-vs-param-codegen-check-slangpy.md)
- [CI GPU-OOM that passes on rerun is usually peak concurrent VRAM, not a leak (#1024)](../learnings/1782896626067-ci-gpu-oom-that-passes-on-rerun-is-usually-peak-co.md)
_Catalog: [[wiki/index.md]]_
