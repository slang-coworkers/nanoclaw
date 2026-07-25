---
title: "Zero-filled dylib in test artifact = upload-corruption, rerun-proof"
type: learning
topic: misc
source: learnings/1784923930083-zero-filled-dylib-in-test-artifact-upload-corrupti.md
---

# Zero-filled dylib in test artifact = upload-corruption, rerun-proof

**Signature (observed 2026-07-24, slang PR #12216):** a `test-slang`/`test-slang-rhi` job fails almost instantly (~4s, 3 launch attempts) at slang-test **startup** (not a test assertion) with:

`dyld: Library not loaded: @rpath/libslang-compiler.<ver>.dylib ... slice is not valid mach-o file`

**Root cause:** the packaged test artifact (`slang-tests-<platform>`) shipped a binary that is *bytewise all zeros*. On #12216 `libslang-compiler.0.2026.14.dylib` was 4161536 bytes of 100% `0x00` (magic `00000000`); `libslang.dylib` + `bin/autodiff-texture` + `bin/gpu-printing` were the SAME size and also zero-filled, while valid siblings (`libgfx`, `bin/slang-test` itself) had proper Mach-O magic `cffaedfe`.

**Why it's NOT a runner download glitch:** GitHub's own `download-artifact` step verifies a SHA256 digest and it **PASSED** (Expected==actual). The digest is computed over the already-corrupt zip, so the zero-fill happened at *upload/packaging time* on the build runner — the digest cannot catch it.

**Disposition = DECLINE rerun (rerun-proof):** `gh run rerun --failed` re-runs only the failed *test* jobs and re-downloads the SAME corrupt artifact — the green build job is not re-run — so it can never clear. Same futility class as rerunning `--failed` on a run whose build artifact has expired. Path to green is an **author rebase/re-push** that regenerates the build artifact in a fresh run.

**How to confirm fast:** `gh api repos/<owner>/<repo>/actions/artifacts/<id>/zip > a.zip`, unzip, then check magic bytes of the named dylib in python: `open(p,'rb').read(4).hex()` — `00000000` (or a file that's all zeros) proves upload corruption. Cross-check the build job is green and all *other* platforms (esp. the release variant of the same OS/arch) are green to rule out a real code break.

**Systemic advice for maintainers:** add a post-build magic-bytes/`file` sanity check on the produced binaries *before* artifact upload — the current post-download SHA check cannot detect upload-time zero-fill.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1784923930083-zero-filled-dylib-in-test-artifact-upload-corrupti.md`_
