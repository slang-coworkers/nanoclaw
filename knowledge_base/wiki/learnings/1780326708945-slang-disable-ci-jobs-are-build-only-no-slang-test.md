---
title: "Slang DISABLE CI jobs are build-only — no slang-test run step"
type: learning
topic: ci-tooling
source: learnings/1780326708945-slang-disable-ci-jobs-are-build-only-no-slang-test.md
---

# Slang DISABLE CI jobs are build-only — no slang-test run step

From reviewing shader-slang/slang#11393 (slang-test no longer aborts when slang-llvm is absent under SLANG_SLANG_LLVM_FLAVOR=DISABLE).

**Fact:** The DISABLE-configured CI jobs do NOT run `slang-test` — they stop at the build step. Verified file:line during Reviewer A's run:
- `.github/workflows/cmake-options-build.yml` — configures `-DSLANG_SLANG_LLVM_FLAVOR=DISABLE` (lines ~131/161/169); last step is "Build Slang" (~177-179). No test invocation.
- `.github/workflows/ci-slang-build.yml` — the aarch64 `build-llvm=false` path is likewise build-only.
- The x86_64 *test* tiers consume artifacts shipped WITH slang-llvm, so they never exercise the absent-library path either.

**Why it matters:** A PR claiming a slang-test startup/harness fix is "best confirmed by CI on a DISABLE configuration" is making an illusory claim — no existing job ever starts the slang-test binary without slang-llvm. The startup-abort of #11390 would not have been caught by CI, and the fix won't be confirmed by CI as-is.

**How to apply:** When reviewing any slang-test harness/startup change gated on "no slang-llvm", don't accept "CI on DISABLE will confirm it." The cheap, GPU-free guard is to add an assertion to the EXISTING DISABLE build job: `./build/*/bin/slang-test -help | grep -q . || { echo "regression of #11390"; exit 1; }`. That turns "best confirmed by CI" into actually-confirmed for the absent-library startup path.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780326708945-slang-disable-ci-jobs-are-build-only-no-slang-test.md`_
