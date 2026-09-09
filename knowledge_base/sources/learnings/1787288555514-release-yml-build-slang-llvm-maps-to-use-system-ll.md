---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787288137975-eaae5g
written_at: 2026-08-21T05:02:35.514Z
---

# release.yml build-slang-llvm maps to USE_SYSTEM_LLVM/DISABLE, not FETCH

When triaging "slang-llvm missing for platform X in the release" (e.g. #12675, native Windows ARM64), note there are TWO distinct DISABLE surfaces from ONE root cause, and the release build does NOT use the default `FETCH_BINARY_IF_POSSIBLE` flavor:

1. **Release build (the producer).** `.github/workflows/release.yml:161-162` maps the matrix var `build-slang-llvm` directly: `true` → `-DSLANG_SLANG_LLVM_FLAVOR=USE_SYSTEM_LLVM`, else `DISABLE`. `build-slang-llvm: true` is set (via `include:`) for ONLY linux/x86_64, windows/x86_64, macos/aarch64 (`release.yml:70-83`, base default false at :70). Any other platform is built with `DISABLE` outright — no fetch is even attempted. So the release zip for that platform never contains slang-llvm.

2. **Downstream consumer.** A user `cmake`-configuring Slang on that host with the default `SLANG_SLANG_LLVM_FLAVOR=FETCH_BINARY_IF_POSSIBLE` (`CMakeLists.txt:407-421`) then silently falls back to DISABLE (`CMakeLists.txt:428-432`, `cmake/LLVM.cmake:26-38` IGNORE_FAILURE) because no `slang-<ver>-<os>-<arch>.zip` asset carries the lib to fetch. `cmake/GitHubRelease.cmake:4-5,57-59` builds a well-formed URL (arch match `aarch64|ARM64|arm64`) — the asset just doesn't exist.

**How LLVM is obtained (feasibility check):** `build-slang-llvm:true` → `common-setup/action.yml` → `setup-llvm-from-gcs` (downloads a GCS-cached prebuilt per os/compiler/platform/hash, else builds from source via `external/build-llvm.sh`, which pins llvmorg-21.1.2 and already lists `AArch64` in `LLVM_TARGETS_TO_BUILD`). macos/aarch64 is the working NATIVE ARM64 precedent (no cross flags beyond CMAKE_OSX_ARCHITECTURES). Enabling a new ARM64 platform means a native runner + first-build-from-source (no GCS cache seeded yet = slow).

**Routing:** `release.yml` is under `.github/workflows/` — the bot has no `workflows` GitHub permission, so any PR editing it must be merged by a human maintainer. Fixes here are human-in-the-loop, not bot auto-merge.

Umbrella issue for the general case: #4836 "build slang-llvm on all platforms".
