---
name: khr-validation
license: MIT
description: 'How to set up dependencies, build and validate khr job repositories with recorded evidence: the run-check wrapper, the shared build lease, prepared offline dependencies (Vulkan-Docs npm, VVL, CTS), validation profiles and the pinned-header workaround, and focused gtest/ctest rules. Use for every setup, build and check.'
provides: [test.run]
---

# khr validation

Tools are under `/app/skills/khr-validation/scripts/`, which is read-only. If a helper named here isn't installed in this image, record that check as `infrastructure_error` (missing tool) and carry on with the other work.

## Toolchain (once per job, before any check)

The image carries the CPU-only baseline (`apt-packages.txt`): compilers, CMake/Ninja, Python, asciidoctor/AsciiDoc, JRE and jing, xsltproc, `ag`, the Vulkan loader.

The pinned overlay comes from `requirements-toolchain.txt`: clang-format 22.1.x, pyparsing 3.3.2, beautifulsoup4. Install it offline into the job's dependency root, through the wrapper:

```
python3 /app/skills/khr-validation/scripts/run_check.py --job /workspace/agent/jobs/<job> --kind setup \
  --name toolchain --repository /workspace/agent/jobs/<job>/repos/<any> -- \
  python3 /app/skills/khr-validation/scripts/setup_toolchain.py --job /workspace/agent/jobs/<job>
```

- Then put its `bin` first on `PATH`, using the printed `source …/toolchain.env`, in every later command that needs `clang-format` or the pinned Python.
- The overlay installs only from the read-only wheel cache, never from the network. A missing cache or a failed install is `infrastructure_error`.
- `toolchain.json` records the exact tool versions. Cite it when a check depends on a tool version.

## Every setup and check goes through the wrapper

```
python3 /app/skills/khr-validation/scripts/run_check.py \
  --job /workspace/agent/jobs/<job> --kind validation --name xml-consistency \
  --repository /workspace/agent/jobs/<job>/repos/vulkan-docs -- \
  python3 scripts/xml_consistency.py
```

- Use the wrapper for every dependency-setup attempt, generator, build and validation command. Don't run a check directly and then rerun it through the wrapper just to create a record.
- Setup runs use `--kind setup`; real checks use `--kind validation`. `--repository` is the exact affected worktree root.
- Retries of the same logical check reuse the same stable `--name`. Never add `final`, `fixed`, `retry` or `attempt` suffixes.
- Copy the printed `checkId` into the matching `tests[]` entry of your report. The finish step reconciles the command, result, failure category and exit code from the wrapper's evidence log, and that log is authoritative.

## Per repository: discover, then validate

1. Discover the current workflow from the pinned checkout: contributor and build docs, CI configuration, dependency manifests and lockfiles. Prefer the commands existing CI uses. A remembered command, or one that worked in another checkout, is only a hint.
2. Reuse a compatible installed tool or package when its imports and version work. Don't reinstall working dependencies just for isolation.
3. If setup is needed, follow the offline invariant: only declared dependencies, one recorded deterministic attempt, under `$KHR_DEPENDENCY_ROOT`, never `sudo`.
4. If package access is denied or no compatible dependency exists, record it as `infrastructure_error`. Don't retry repeatedly or substitute another source, and continue with the other checks.

## Build lease (native compilation)

- Mark every native compilation with `--resource build`. That includes `vvl_offline_deps.py`, CMake, Ninja and Make builds, Vulkan-Loader builds, and configure commands that compile dependencies.
- The lease allows one heavy build at a time across all jobs. A waiting build doesn't use up its command timeout.
- Wait in the same execution session and never launch a duplicate build. Keep downloads, lightweight checks and inference outside the lease.
- Use `$KHR_BUILD_JOBS` for explicit width (`ninja -j $KHR_BUILD_JOBS`), or omit CMake `--parallel` to use `CMAKE_BUILD_PARALLEL_LEVEL`. Never choose your own width.
- Dependency setup and compilation can be silent for many minutes. Allow up to 30 minutes for setup and 30 for compilation unless the command itself errors. Never send Ctrl-C, cancel, or declare a quiet command failed.

## Prepared dependencies

Read `dependency-inventory.json` for every configured repository. "Ready" means the sources were materialized; it says nothing about configuring, building or testing.

- **Vulkan-Docs:** `npm ci --offline --ignore-scripts --no-audit --no-fund` with the prepared cache (`$npm_config_cache`), through the wrapper.
- **Vulkan-ValidationLayers:**
  1. With ready inputs, first run `python3 /app/skills/khr-validation/scripts/vvl_offline_deps.py <REPOSITORY> --dir $KHR_DEPENDENCY_ROOT/vvl --config debug --generator Ninja`. Use absolute paths, run it through the wrapper with `--resource build`, and allow 30 minutes.
  2. Then configure with `UPDATE_DEPS=OFF`, `-C $KHR_DEPENDENCY_ROOT/vvl/helper.cmake`, `BUILD_TESTS=ON`, the approved CPU-only flags, and all Linux WSI support disabled.
  3. Never use `UPDATE_DEPS=ON`: it always fetches from GitHub and fails offline. Without ready preparation, record the missing inputs as `infrastructure_error`.
- **VK-GL-CTS:**
  1. Read `README.md` and `external/vulkancts/README.md`.
  2. With ready inputs, run `python3 /app/skills/khr-validation/scripts/cts_offline_deps.py --repository <ABS> --dependency-root $KHR_DEPENDENCY_ROOT/cts` through the wrapper.
  3. Compile `deqp-vk` through the build lease with Vulkan video disabled. Never execute it.
  4. Changed dependency declarations need host preparation again.

## Validation profiles

- **Freeze committed sources into a separate build tree** with `python3 /app/skills/khr-validation/scripts/prepare_profile.py --consumer <NAME> --mode pinned-baseline` (or `--mode integration`):
  - Commit consumer and provider edits locally first.
  - Keep all build outputs outside editable provider repositories.
  - Pass the printed `profileId` to the wrapper with `--profile`, and report baseline and integration checks separately.
  - Integration uses one committed job `HEAD` per configured provider, covering direct and nested roles. Disclose absent and unsupported roles.
- **Pinned-header workaround (temporary, test-only).** Use it only when the configured header branches are incompatible: `--mode pinned-header-workaround --header-patch PROVIDER=<ABS_PATCH>`.
  1. In a separate scratch copy, manually port the intended committed Vulkan-Headers or SPIRV-Headers changes onto each consumer's declared pin.
  2. Store the resulting patch inside the job. Only regular files under `include/` and `registry/` are accepted.
  3. Report these checks separately, with the pin, provider revision, patch hash, any manual conflict resolution and coverage limits.
  4. A pass doesn't prove the configured branches are compatible, and the port commits must never be published.

## Focused tests

- Use the wrapper's `--test-framework gtest` or `ctest` with `--expect-test <NAME>`, and `ctest --no-tests=error`. Check the discovered, run, passed and skipped counts: zero tests, or all tests skipped, can never pass.
- **VVL tests:**
  - Configure a job-local build if none exists; a missing build directory isn't a reason to skip.
  - Build the narrowest applicable targets and run only the focused gtest filter, excluding GPU-AV, WSI, display and CTS tests.
  - Set `VK_DRIVER_FILES` to the absolute path of the *generated* `build/tests/icd/VVL_Test_ICD.json` (never the source template, never any other ICD). Use an approved CPU loader library, and set the Test ICD library path.
  - A missing loader is `infrastructure_error`.
  - If unsure whether a test is CPU-only, don't run it, and say so.
- **A skipped requested test is `skipped`.** First make a reasonable attempt to adjust only unnecessary test prerequisites so it runs under the Test ICD. For example, enable the owning extension without requiring its feature, when the repository's test guidance and nearby tests support that. Never weaken production validation or use a system ICD to avoid a skip.
- **SPIR-V offline anchor checks** report remote document URLs as `skipped`.
- **Toolchain-only profiles** don't imply test coverage.
