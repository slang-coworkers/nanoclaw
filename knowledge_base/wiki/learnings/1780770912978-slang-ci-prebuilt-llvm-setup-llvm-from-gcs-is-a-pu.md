---
title: "slang CI: prebuilt LLVM (setup-llvm-from-gcs) is a public-bucket curl download with NO auth — not a blocker for moving builds between self-hosted pools"
type: learning
topic: ci-tooling
source: learnings/1780770912978-slang-ci-prebuilt-llvm-setup-llvm-from-gcs-is-a-pu.md
---

# slang CI: prebuilt LLVM (setup-llvm-from-gcs) is a public-bucket curl download with NO auth — not a blocker for moving builds between self-hosted pools

## Fact

In shader-slang/slang's GitHub Actions, the prebuilt LLVM that `common-setup` provides is fetched by the `setup-llvm-from-gcs` composite action via a **plain `curl` from a publicly-readable GCS bucket — no authentication required** (`.github/actions/setup-llvm-from-gcs/action.yml:43-44`, whose own comment says "The bucket is publicly readable — download via curl (no gcloud SDK needed)").

The `google-github-actions/auth@v2` / workload-identity step is **NOT** in `common-setup`. It lives caller-side in `ci-slang-build.yml` and is exercised **only on the upload path** (cache-miss on master, re-populating the bucket). The download path that every build uses needs no Google Cloud auth.

## Why this matters / how to apply

When reasoning about whether a Slang build job can move from one self-hosted runner pool to another (e.g. PR #11495 moving the Falcor build off the GPU `falcor` pool onto the standard `build` pool), **"the new pool would need GCS/LLVM auth wired up" is a FALSE blocker.** The LLVM download works from any runner with network egress; no workload-identity, no gcloud SDK.

Observed in #11495: an initial triage concluded "Approach A (windows-latest / different pool) is blocked by LLVM needing GCS workload-identity auth." That reasoning was **wrong**. The only *real* toolchain blocker for moving that build was **CUDA** (`-DSLANG_ENABLE_CUDA=1` needs the CUDA toolkit preinstalled on the image; `common-setup` does NOT install it). sccache is also caller-side (`ci-slang-build.yml`), not `common-setup`.

So when auditing a build-pool move, the toolchain checklist is:
- **LLVM** — public-bucket curl, works anywhere. NOT a blocker.
- **CUDA** — must be preinstalled on the runner image; `common-setup` won't provide it. REAL blocker / load-bearing assumption — verify the target pool's image has it (fails loud at cmake-configure if absent).
- **sccache** — wired in `ci-slang-build.yml`, not `common-setup`; absent = uncached build, not a failure.

A comment in a workflow that attributes LLVM provisioning to "GCS workload-identity" is inaccurate and will send a maintainer hunting for auth the job neither has nor needs — flag it in review.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780770912978-slang-ci-prebuilt-llvm-setup-llvm-from-gcs-is-a-pu.md`_
