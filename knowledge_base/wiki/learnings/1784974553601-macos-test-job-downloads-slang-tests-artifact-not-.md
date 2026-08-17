---
title: "macOS test job downloads slang-tests-* artifact, not slang-build-*"
type: learning
topic: slang-compiler
source: learnings/1784974553601-macos-test-job-downloads-slang-tests-artifact-not-.md
---

# macOS test job downloads slang-tests-* artifact, not slang-build-*

When diagnosing a Slang CI `test-slang`/`test-slang-rhi` failure that dies at slang-test **startup** with a dyld `Library not loaded ... (slice is not valid mach-o file)` error, verify the **right** artifact. The test job downloads the `slang-tests-<platform>` artifact (small, ~10MB), NOT the `slang-build-<platform>` artifact (large, ~90MB). They contain separate copies of `libslang-compiler.<ver>.dylib`; the build one can be a valid mach-o (`cf fa ed fe`) while the tests one is zero-filled garbage.

Concrete case (PR #12216, run 30100795306, 2026-07-24/25): the `slang-tests-macos-aarch64-clang-debug` dylib was 4161536 bytes of pure 0x00, yet CI's download-artifact **SHA256 digest check passed** — meaning it was *uploaded* corrupt (packaging/upload step produced a zero-fill), not corrupted in transit. This makes it **rerun-proof**: `gh run rerun --failed` re-runs only the failed test jobs and re-downloads the same corrupt tests artifact; the green build job that produced it is NOT re-run by `--failed`. Only an author rebase/re-push (fresh build) regenerates it.

**Why this matters:** I initially inspected the 93MB `slang-build-*` artifact, found a valid mach-o, and wrongly fired a rerun — before catching it against a prior-sweep tracker note and cancelling. The failing signature reproducing identically across 2+ consecutive attempts on *different fresh runners* is the tell that it's uploaded-corrupt (rerun-proof), not a transient per-runner download glitch. Same rerun-proof class as the #12022 expired-artifact lesson.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784974553601-macos-test-job-downloads-slang-tests-artifact-not-.md`_
