# Slang capability-error PRs break downstream slangpy via E36121 (cross-repo intended break)

## What

On 2026-08-03, slang PR #11225 ("Capabilities: error on capabilities incompatible with compilation target", fixes #4422, author zangold-nv, labeled `pr: breaking change`) turned its cross-repo `SlangPy Tests` status red with:

```
error[E36121]: requested capability 'hlsl_nvapi' is incompatible with compilation target 'spirv'
error[E39999]: import failed due to compilation error
fatal error[E40003]: compilation ceased
```

28 identical occurrences on **both** linux-gcc and windows-msvc, on **both** run attempts. `sgl_tests`: 172 passed / 28 failed / 3 skipped — but **0 of 18535 assertions failed**. Every one of the 28 failures was a thrown `Failed to load slang module "test" from source`, not a CHECK. The Slang C++ build itself was fully green (`[1450/1450]`).

## Why it matters for CI triage

This looks superficially like the known slangpy cross-repo flake buckets but is **none of them**. Discriminators that ruled them out:

- Not the fiddle/GCC-PCH break (#12227, fixed by #12233 merged 07-26): zero `'friend' used outside of class` hits, and the PR was rebased past the fix.
- Not the Windows `setup-python` toolcache infra flake: that step succeeded in 98 ms.
- Not the `sgl_tests` exit-1-after-all-pass teardown flake: there were 28 *real* test-case failures, not an exit-code-only artifact.
- Not CUDA-OOM (#1024) or a `test_nested` data mismatch: zero OOM/numeric-mismatch markers.

## The generalizable rule

**A slang PR whose whole purpose is to add a new diagnostic will legitimately break downstream repos that trip it.** Verify the causal link in the PR's own diff rather than inferring it from the title — `gh api /repos/shader-slang/slang/pulls/<N>/files --jq '.[].patch'` and grep for the diagnostic code. Here the diff added `36121` + the message template in `slang-diagnostics.lua`, the `RequestedCapabilityIncompatibleWithTarget` raise in `slang-target.cpp` (+79/-3), and a new test `incompatible-capability-for-target.slang`. That is proof, not correlation.

Disposition: **legitimate, not rerunnable.** Deterministic across platforms and attempts. Route to the PR author for coordination — the real question is whether the downstream repo needs a target-conditional guard (slangpy requests `hlsl_nvapi` from `src/sgl/device/shader.cpp` while compiling for spirv/vulkan), not whether the slang change is wrong. An intended breaking change needs a downstream fix landed alongside it.

## Bonus: bot permissions on slangpy

`gh api /repos/shader-slang/slangpy --jq '.permissions'` returns `admin/maintain/push/triage/pull` **all false** — yet **log reads still succeed** (`/actions/jobs/<id>/logs` returned full 4289-line bodies first try). So "no permissions" does NOT mean you can't classify a cross-repo failure; you can read and diagnose, you just can't `gh run rerun`. Don't skip classification of cross-repo reds on the assumption logs are unreachable.
