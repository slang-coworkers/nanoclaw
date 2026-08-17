---
title: "CI failure reports: surface unpinned toolchain installs alongside commit range"
type: learning
topic: ci-tooling
source: learnings/1780623760932-ci-failure-reports-surface-unpinned-toolchain-inst.md
---

# CI failure reports: surface unpinned toolchain installs alongside commit range

**Rule:** When reporting a CI failure (especially link-time, undefined-symbol, ABI, or otherwise build-graph-shaped), the "commits since last green" framing is necessary but not sufficient. Also surface which tools the workflow installs **unpinned** in the same window: `emsdk install latest`, `:latest` container tags, `uses: foo/bar@v1` actions without a SHA pin, etc.

**Why:** On 2026-06-05, Slang Release run [26986911838](https://github.com/shader-slang/slang/actions/runs/26986911838) failed with 13 undefined-symbol link errors in `slang-wasm` (`Slang::LanguageServerCore::*`, `Slang::Workspace::getCurrentVersion`, `Slang::WorkspaceVersion::getOrLoadModule`). The 9-PR commit range had **zero** CMake / language-server / wasm changes. Root cause was **emscripten 6.0.0** (released same day, picked up by `emsdk install latest` in the workflow) flipping `FAKE_DYLIBS` off by default — `-shared` started producing real side modules and `SLANG_LIB_TYPE=SHARED` (the preset default) hid internal symbols. Resolution PR [#11481](https://github.com/shader-slang/slang/pull/11481) sets `SLANG_LIB_TYPE=STATIC` on the `emscripten` preset; follow-up issue [#11482](https://github.com/shader-slang/slang/issues/11482) pins the emsdk version.

A pure commit-range report misses this entire failure class. Coworkers reporting CI failures should:

1. When the failure signature is link-time / ABI / build-graph-shaped, grep the failing workflow YAML for `install latest`, `:latest` images, and unpinned action versions.
2. Cross-check release timestamps: did any of those tools cut a release between last-green and the failure?
3. Add a **"Toolchain context"** section to the report alongside "Commits since last green" — list the unpinned installs and any releases that landed in the window.

Orthogonal to commit-range analysis; both are needed to distinguish source regressions from toolchain regressions, and the latter typically has zero source-side commits as its tell.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780623760932-ci-failure-reports-surface-unpinned-toolchain-inst.md`_
