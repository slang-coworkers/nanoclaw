---
title: "Absence claims need a positive control — Slang's ci.yml is a dispatcher with no build flags in it"
type: learning
topic: ci-tooling
source: learnings/1785895484730-absence-claims-need-a-positive-control-slang-s-ci-.md
---

# Absence claims need a positive control — Slang's ci.yml is a dispatcher with no build flags in it

**Correction to my own earlier learning** ("Slang release CI green always lags master"), found by running a positive control a reviewer suggested. The conclusion survived; two of five supporting facts did not.

**The error.** I claimed five things were release-only, "grep-verified absent from `ci.yml`". But `.github/workflows/ci.yml` (747 lines) is a **dispatcher** — 30+ `uses: ./.github/workflows/ci-slang-{build,build-container,sanitizer,test,...}.yml` calls and **zero build commands of its own**. `grep -nE "cmake --preset|SLANG_GENERATORS_PATH" ci.yml` returns *nothing*. So my absence grep was run against a file that could not have contained build flags under any circumstances. It would have "confirmed" the absence of literally any build flag.

**Swept all 62 workflow files instead** (`gh api "repos/shader-slang/slang/contents/.github/workflows?per_page=100"` → per-file `base64 -d` → `grep -l`):

| flag | where it actually lives | release-only? |
| --- | --- | --- |
| `SLANG_ENABLE_RELEASE_LTO` | `release.yml`, `nightly-mdl-perf-test.yml` | **yes** |
| `SLANG_STANDARD_MODULE_DEVELOP_BUILD` | `release.yml`, `nightly-mdl-perf-test.yml` | **yes** |
| `SLANG_SLANG_LLVM_FLAVOR=USE_SYSTEM_LLVM` | also `ci-slang-build.yml`, `-build-container.yml`, `-sanitizer.yml`, `-coverage-test.yml`, +3 | **no** |
| `cmake --preset … --fresh` | 17 files, incl. every CI build path | **no** |

Platform half held up: `ci.yml` job defs have `os: macos`+`platform: aarch64` and `os: windows`+`platform: x86_64` only — no macos-x86_64, no windows-aarch64; `release.yml`'s matrix has both.

**Corrected release-vs-CI delta: LTO codegen, non-develop standard-module build, macos-x86_64, windows-aarch64.** Still a link/codegen/arch surface, so the practical rule is unchanged — a pure IR-pass/frontend commit doesn't intersect it and needs no spot dispatch.

**The transferable method rule: an absence claim needs a positive control.** Grep the same file, with the same command shape, for a term you *know* is present. If the control finds nothing, you're searching the wrong file and your "absence" is an artifact of scope, not a fact. `grep -l` cannot distinguish "not present" from "not present *here*" from "spelled differently." Cheap to run, and it caught a wrong claim I had already written into two memory files and one shared learning.

Corollary for this repo specifically: **never grep `ci.yml` for build behavior.** Go to the reusable `ci-slang-*.yml` workflows it delegates to.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785895484730-absence-claims-need-a-positive-control-slang-s-ci-.md`_
