---
title: "DXC prebuilt fetch HTTP 500 fails the build despite a source-build fallback (FetchDXC.cmake has no retry)"
type: learning
topic: ci-tooling
source: learnings/1785759110494-dxc-prebuilt-fetch-http-500-fails-the-build-despit.md
---

# DXC prebuilt fetch HTTP 500 fails the build despite a source-build fallback (FetchDXC.cmake has no retry)

**Signature (seen 2026-08-03 on shader-slang/slang #12116, and cross-repo in slangpy):**

Slang side, `build-linux-debug-gcc-x86_64 / build`, step "Build Slang with CUDA":
```
-- Downloading DXC prebuilt binary to detect GLIBC requirement...
CMake Error at cmake/FetchDXC.cmake:277 (file):
  file DOWNLOAD cannot compute hash on failed download
    status: [22;"HTTP response code said error"]
CMake Warning at cmake/FetchDXC.cmake:287 (message):
  Failed to download DXC prebuilt binary. Building DXC from source instead.
...
-- Configuring incomplete, errors occurred!
```
SlangPy side, same hour, **same root cause** (so a slang PR shows BOTH a red slang build and a red cross-repo `SlangPy Tests`):
```
CMake Error at .../download-dxc-populate.cmake:163 (message):
  Each download failed!
    error: downloading '.../v1.9.2602/dxc_2026_02_20.zip' failed
    The requested URL returned error: 500
ninja: build stopped: subcommand failed.
```

**Classification: intermittent (network/dep-fetch).** Rerunnable. Discriminators that prove it: only 1 of 9 slang build configs failed; the *identical* `build-linux-debug-gcc-x86_64` job was green on other runs in the same hour (runs 30809061828 @11:19Z, 30810819138 @11:45Z); and the PR's own prior head was all-green 2h earlier. Disk was fine (75 GB avail) — don't misread it as a space issue. Precedent: #11589 (2026-06-16) had the identical `cannot compute hash on failed download`.

**Two non-obvious traps:**

1. **The "Building DXC from source instead" fallback is a red herring.** The `file(DOWNLOAD ...)` failure is emitted as a CMake **Error** *before* the fallback warning, and configure still dies with `Configuring incomplete, errors occurred!` / exit 1. So the fallback does NOT save the build — don't skim the log, see "Building DXC from source instead", and conclude it recovered.

2. **`FetchDXC.cmake` has no retry, and the in-flight retry PR does not cover it.** PR #12323 ("Retry fetching a prebuilt shared library...") touches **only** `cmake/FetchedSharedLibrary.cmake`. Verified against master source: `FetchDXC.cmake:277` is a bare `file(DOWNLOAD "${_dxc_probe_url}" ... EXPECTED_HASH ...)` with a single attempt and no retry loop. A GitHub-Releases 500 there will keep flaking the fleet until `FetchDXC.cmake` gets the same retry treatment. Worth pointing a maintainer at, since it's a one-place fix that removes a whole rerun bucket.

**Operational note:** `gh run rerun <id> --failed` is refused with `cannot be rerun; This workflow is already running` while *any* job in the run is still in progress — common when the flake is an early build job and GPU test jobs are still going. That refusal consumes no rerun-cap slot; just retry on the next sweep once the run concludes.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785759110494-dxc-prebuilt-fetch-http-500-fails-the-build-despit.md`_
