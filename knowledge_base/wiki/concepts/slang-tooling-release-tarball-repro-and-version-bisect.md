---
title: "Reproducing version-specific Slang bugs with release tarballs, and bisecting across releases"
type: concept
group: slang-tooling
tags: [slang, release-tarball, gh-release-download, bisect, version-matrix, c-api, libslang-compiler, exit-codes, triage, regression, git-tag-contains, blobless-clone, soname-swap]
source_count: 7
---

# Reproducing version-specific Slang bugs with release tarballs, and bisecting across releases

Prebuilt Linux release tarballs answer "does version X have this bug?" without a CMake build. This page covers fetching and running them, bracketing a change between releases, bisecting a C++ API or GPU regression against each tarball, and the pitfalls that fake a pass or a fail.

## TL;DR

- A release tarball answers a version question in about a minute, with no build and no GPU: `gh release download v<ver> -R shader-slang/slang -p "slang-<ver>-linux-x86_64.tar.gz"` (or the asset `browser_download_url`), extract, run `bin/slangc` with `LD_LIBRARY_PATH=<dir>/lib` (2024-era tarballs: `bin/linux-x64/release/`). On a glibc-2.36 host (Debian-12 coworker container) use the `-glibc-2.27` asset; the standard one needs GLIBC 2.38.
- A local build's `slangc -version` is fixed at configure time: check freshness with `git reflog` vs the build's mtime and `find source -newer <lib>`.
- Bracket a change with adjacent release tags: `git tag --no-contains <sha> | sort -V | tail -1` and `git tag --contains <sha> | sort -V | head -1` in a full clone with tags, then run both tarballs. Run every target the report names and the nearby source variants; after a bracket, list the window's commits and name the trigger.
- When the shared clone cannot fetch (`bad object refs/remotes/...`, `failed to run repack`), don't repair it: `git clone --filter=blob:none --no-checkout https://github.com/shader-slang/slang.git /tmp/slang-bl` takes ~2 s, has full history, fetches blobs on demand (`git show <rev>:<path>`, `git log -S`), and spends no REST quota.
- Compare two releases' codegen by diffing `-target spirv-asm` with IDs normalized: `sed -E 's/%[A-Za-z0-9_]+/%X/g'`. Download tarballs from `github.com/.../releases/download/v<ver>/<asset>` (no API quota).
- C++ compilation-API bugs: link a tiny repro against each tarball's `include/` and `lib/` (`-lslang-compiler`).
- GPU runtime bugs: run master's slang-test against a release's `libslang-compiler` renamed to master's NEEDED SONAME via `LD_LIBRARY_PATH`; confirm with `LD_DEBUG=libs` and keep `libslang-llvm.so` beside it.
- Exit codes mislead: `-target glsl` exit 0 is not valid GLSL (check with `-target spirv -emit-spirv-via-glsl`); a wrong slangc path under `$(...)` plus `grep error` prints "OK", so always print the exit code. Pass a real `-o` path: `-o /dev/null` gives E00004.
- A failure on a release that already contains the fix is probably a separate variant, not a failed fix.

## Fetching and running a release

On a glibc-2.36 host such as the Debian-12 coworker container, the standard tarball (and the dxc binaries cached in scratch dirs) needs GLIBC 2.38 and will not start; every release also publishes `slang-<ver>-linux-x86_64-glibc-2.27.tar.gz`, which runs there (`curl -sfL .../releases/download/v<ver>/<asset>` into /tmp). Two adjacent tags then pin a boundary in a minute: for #13931, v2026.1.1 compiles and v2026.1.2 rejects with E30701, pinning #9260; `-ignore-capabilities` suppresses that front-end system-value type check and shows what the backends would do ([glibc-2.27 tarballs](../learnings/1792917334487-bisect-old-slang-behavior-on-a-glibc-2-36-host-use.md)).

**Check a local build before trusting its version.** A local `slangc -version` is fixed at configure time, so it can be stale; compare `git reflog` (when HEAD moved) with the build's mtime and run `find source -newer <lib>` ([glibc-2.27 tarballs](../learnings/1792917334487-bisect-old-slang-behavior-on-a-glibc-2-36-host-use.md)).

## Choosing the version bracket and finding the fix commit

Bracket a suspect commit with the release tags on either side, `git tag --no-contains <sha> | sort -V | tail -1` and `git tag --contains <sha> | sort -V | head -1`, then fetch each with `gh release download v<ver> -R shader-slang/slang -p "slang-<ver>-linux-x86_64.tar.gz"`. For #14281, WaveMatch lost its `#extension` in PR 4099, between v2024.1.11 and v2024.1.12 ([release tarballs in minutes; #14281](../learnings/1793750844303-confirm-a-slang-regression-in-minutes-with-officia.md)). The same bracket answers "is this old-version report already fixed?": #14445's text output was wrong in v2026.20 and right in v2026.21, the first release with the #13283 fold fix ([#13283 fold fix covers #14445](../learnings/1794332130849-13283-fold-fix-also-covers-register-coalesced-inde.md)).

**Fresh source and a codegen diff without REST quota.** The shared `/workspace/agent/slang` clone can be broken: on 2026-10-27 its fetch failed with "bad object refs/remotes/origin/Sirox0/master; failed to run repack" and `origin/master` was stuck at 04-15. Leave it alone and make a blobless clone: `git clone --filter=blob:none --no-checkout https://github.com/shader-slang/slang.git /tmp/slang-bl` takes about 2 s, carries the full history, and fetches blobs on demand for `git show <rev>:<path>`, `git log -S` and per-path history. To check a "regressed between release X and Y" report, download both `github.com/shader-slang/slang/releases/download/v<ver>/slang-<ver>-linux-x86_64.tar.gz` assets (a plain download, no API quota), compile the same shader with each, and diff the `spirv-asm` after normalizing IDs with `sed -E 's/%[A-Za-z0-9_]+/%X/g'`, so that only real instruction changes remain. The tarballs also ship `include/` and `lib/libslang-compiler.so`, so the linked API probes below work from the same downloads ([blobless clone + cross-release codegen diff](../learnings/1793089764882-fast-fresh-slang-source-cross-release-codegen-diff.md)).

## Bisecting API and GPU regressions against a release library

**Run a release's compiler under master's slang-test on the GPU by SONAME swap.** To ask whether a GPU bug in release vX is fixed on master without building vX, copy the tarball's `lib/*` into a dir and add a copy of `libslang-compiler.so.0.<X>` renamed to the SONAME master's slang-test/render-test NEED (`readelf -d build/Release/lib/librender-test-tool.so | grep NEEDED`, e.g. `libslang-compiler.so.0.2026.13.1`). `LD_LIBRARY_PATH=<dir> ./build/Release/bin/slang-test tests/...` then wins over the `$ORIGIN` RUNPATH; prove which lib loaded with `LD_DEBUG=libs ... | grep 'calling init:.*slang-compiler'`. Keep `libslang-llvm.so` in that dir, or `filecheck-buffer` tests pass vacuously. The same swap with lib-only worktree builds of `<fix>^` and `<fix>` (Release slangc + slang-glslang, ~4 min at `-j64`, ~1.5 min incremental) bisect-confirms a fix commit: on #14231 v2026.20 gave `[0,3]`, master `[2,3]`, confirming #13742 ([run a released compiler under the master slang-test harness via SONAME swap](../learnings/1793683623557-run-a-released-slang-compiler-under-the-master-sla.md)).

## Pitfalls: exit codes and output paths

In 2024-era tarballs slangc is at `bin/linux-x64/release/slangc`, not `bin/slangc`; with a wrong path, `$(...)` capture plus `grep error` prints "OK", so always print the exit code. `slangc -target glsl` exiting 0 does not mean the GLSL is valid: `-target spirv -emit-spirv-via-glsl` runs glslang on it. To find which core-module attribute fixes a GLSL error without editing the compiler, write a user function with the same `__target_switch { case glsl: __intrinsic_asm "..." }` and add `__glsl_extension(...)` / `__spirv_version(...)` one at a time ([release tarballs in minutes; #14281](../learnings/1793750844303-confirm-a-slang-regression-in-minutes-with-officia.md)). Pass a real `-o` path: `-o /dev/null` gives `E00004 cannot write output file` ([verify claims with the release tarball](../learnings/1792571968734-verify-discord-bot-slang-claims-with-the-release-s.md)).

## A failure on a build that has the fix

A failure on a build that already contains the fix is probably a separate variant, not a failed fix: isolate the axis with boundary controls before reopening. Function-local struct conformance is the worked case. A constrained generic method (`apply<T : __BuiltinArithmeticType>`) on a local `struct Op : IOp` crashes the front end (#12987, fixed by PR #12988), while a *generic* local struct (`Op<U>`) passes the front end and crashes in `lowerWitnessTable` (#13092), which #12988 does not fix ([two-stage crash](../learnings/1789483742996-function-local-interface-conformance-crashes-at-tw.md)); the mechanism is on [[wiki/concepts/slang-language-witness-and-conformance.md]].

**Source learnings (7):**
- [Local conformance crashes at two stages (#12987 vs #13092)](../learnings/1789483742996-function-local-interface-conformance-crashes-at-tw.md) — a crash on a build with the fix can be a separate variant
- [Bisect on a glibc-2.36 host with the -glibc-2.27 tarballs](../learnings/1792917334487-bisect-old-slang-behavior-on-a-glibc-2-36-host-use.md) — #13931 → #9260
- [Verify Discord/bot claims with the release tarball](../learnings/1792571968734-verify-discord-bot-slang-claims-with-the-release-s.md)
- [Fast fresh Slang source + cross-release codegen diff without REST quota](../learnings/1793089764882-fast-fresh-slang-source-cross-release-codegen-diff.md) — broken shared clone → 2 s `--filter=blob:none` clone; `releases/download` tarballs; ID-normalized `spirv-asm` diff
- [Run a released Slang compiler under the master slang-test harness (GPU) via LD_LIBRARY_PATH SONAME swap](../learnings/1793683623557-run-a-released-slang-compiler-under-the-master-sla.md) — rename to the NEEDED SONAME; `LD_DEBUG=libs` proof; keep `libslang-llvm.so`; lib-only `<fix>^`/`<fix>` builds (#14231)
- [Confirm a Slang regression in minutes with release tarballs; #14281 WaveMatch](../learnings/1793750844303-confirm-a-slang-regression-in-minutes-with-officia.md) — bracket a suspect sha with `git tag --no-contains/--contains | sort -V`; 2024 layout `bin/linux-x64/release/`; print exit codes; `-emit-spirv-via-glsl` validates GLSL; `__target_switch` user-function probe for `__glsl_extension`
- [#13283 fold fix also covers register-coalesced index vars (#14445)](../learnings/1794332130849-13283-fold-fix-also-covers-register-coalesced-inde.md) — v2026.20 broken, v2026.21 fixed; no source build

_Catalog: [[wiki/index.md]]_
