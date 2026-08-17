---
title: "When CI regresses but git diff in the bisect range is empty, suspect the toolchain"
type: learning
topic: ci-tooling
source: learnings/1780623682428-when-ci-regresses-but-git-diff-in-the-bisect-range.md
---

# When CI regresses but git diff in the bisect range is empty, suspect the toolchain

## Rule

For a CI regression where the failing job is a build/link step, **before** running `git bisect`, run `git diff <last-green>..<failing>` restricted to the relevant build inputs (CMakeLists, presets, source dirs the failure touches, the failing target's CMake file). If the diff is empty, the regression is almost certainly in the toolchain or a non-pinned external input, **not** in the listed commits.

## Why

`emsdk install latest` (and similar unpinned installs) defeats the "what changed in slang itself" framing of regression triage. A real example (2026-06-05): the slang Release wasm job started failing with 13 undefined-symbol errors at the slang-wasm link step. The orchestrator handed over 9 candidate commits between last-green `726e0973` and failing `564ac9f`, with strong leverage hints toward two of them. But:

- `git diff 726e0973 564ac9f -- 'CMakeLists.txt' '**/CMakeLists.txt' '**/*.cmake' 'cmake/**' CMakePresets.json source/slang-wasm/ source/slang/slang-language-server* source/slang/slang-workspace-version*` was **empty**.
- Pulling the CI logs revealed `wasm-binaries.tar.xz` hashes differ between the two runs: green = `6cd98e86…`, red = `772bb4648…`. The latter is emscripten 6.0.0, released the same day. Changelog: `FAKE_DYLIBS` is now disabled by default → `-shared` produces real side modules → only default-visibility symbols are exported, so internal C++ symbols (no `SLANG_API`) become undefined at link.
- A correct fix (PR #11481, `SLANG_LIB_TYPE=STATIC` in the `emscripten` preset) was already open and approved by the time triage finished.

## How to apply

When asked to bisect a CI regression:
1. **First**, `git diff <green>..<red>` restricted to the failing target's source/build inputs. Empty diff → skip bisect, go straight to step 2.
2. Pull CI logs from both green and red runs. Diff toolchain hashes / versions: emsdk `wasm-binaries.tar.xz` hash, container image digests, `apt`/`pip`/`npm` install lines, `actions/*@vN` action SHAs, hosted runner image version. Any of those moving while the source diff is empty is your root cause.
3. Search open PRs for the failure signature before opening your own — the build owner often files a fix within minutes.

## Hardening recommendation

Any workflow that runs `emsdk install latest` (or `emsdk activate latest`, or `apt install` of compiler toolchains, or unpinned `npm install -g`) is a future-regression magnet. Pin to a specific tag/version. Filing a separate PR to do this is orthogonal to fixing the immediate breakage and worth doing every time you encounter this class of issue.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780623682428-when-ci-regresses-but-git-diff-in-the-bisect-range.md`_
