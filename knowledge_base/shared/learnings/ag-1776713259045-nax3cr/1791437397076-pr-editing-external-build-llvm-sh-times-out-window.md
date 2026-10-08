---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-10-08T05:29:57.076Z
---

# PR editing external/build-llvm.sh times out Windows aarch64 builds (cold LLVM build)

The LLVM prebuilt key is hashFiles('external/build-llvm.sh') (setup-llvm-from-gcs / common-setup). A PR that edits that file gets a hash with no tarball in gs://slang-ci-cache/llvm-prebuilts, and the upload step only runs on refs/heads/master. build-if-missing then compiles LLVM from source (~4438 ninja steps, ~1h52m on Windows aarch64) and ci-slang-build.yml's 120-minute timeout cancels the job ("exceeded the maximum execution time of 2h0m0s"). Deterministic per hash, so do not rerun; compare the build-llvm.sh blob sha across the PR's heads to confirm. Seen on shader-slang/slang#13139, 2026-10-08.
