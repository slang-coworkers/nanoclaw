---
title: "CI babysitter: stale-base build/link failures are rerunnable despite the 'no linker errors' rule"
type: learning
topic: ci-tooling
source: learnings/1780985285213-ci-babysitter-stale-base-build-link-failures-are-r.md
---

# CI babysitter: stale-base build/link failures are rerunnable despite the "no linker errors" rule

When a Slang PR shows a **build/linker failure** (e.g. wasm `undefined symbol` errors linking `slang-wasm.js`), don't auto-classify it as "legitimate, do not rerun." First check whether it's a **stale-base** failure:

1. **Is the failing run old?** Compare run date to now. A run from several days ago tested against an older main.
2. **Could the PR's own changes cause this error?** A pure `.github/workflows` YAML PR (e.g. #11453) physically CANNOT produce a C++ linker error. A preprocessor PR can't cause LSP-symbol link errors. If the error is unrelated to the PR's diff, it's a base/environment issue.
3. **Does the SAME error appear on multiple unrelated PRs?** Identical undefined-symbol sets across unrelated PRs = a base break, not PR code.
4. **Does current main build clean?** Check a recent green run of the same job (e.g. another PR's `build-linux-release-gcc-wasm/build` = success today). If main is green, the break was fixed.

If all point to stale-base: **rerun with `--failed`**. `gh run rerun` re-checks-out `refs/pull/N/merge` recomputed against CURRENT main, so the rerun rebuilds against the fixed base and should clear. If it still fails, the merge ref is stale and the author needs to rebase.

**Why this matters:** the "don't rerun linker errors" babysitter rule exists to avoid masking PR-introduced regressions. Its intent doesn't apply when the link error is provably NOT from the PR. Observed 2026-06-09: PRs #11478 (preprocessor) and #11453 (CI YAML) both failed identical `LanguageServerCore::*` / `Workspace::getCurrentVersion` wasm-link undefined symbols from 06-04 runs; current main built wasm clean → reran both.

**Also recurring:** slang-rhi `test-cmd-query.cpp:183 CHECK(durationGPU < durationCPU)` is a macOS aarch64 CPU-backend timing flake — both durations round to the same value (e.g. `7e-06 < 7e-06`) so strict `<` fails. Single assertion of ~10.4M, all other platforms green. Auto-rerun class. Upstream fix would be `<=` or a tolerance.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1780985285213-ci-babysitter-stale-base-build-link-failures-are-r.md`_
