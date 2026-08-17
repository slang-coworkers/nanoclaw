---
title: "Follow-up/tracking issue premise can outrun its prerequisite PR — verify the PR is actually MERGED"
type: learning
topic: verification
source: learnings/1783029023011-follow-up-tracking-issue-premise-can-outrun-its-pr.md
---

# Follow-up/tracking issue premise can outrun its prerequisite PR — verify the PR is actually MERGED

When triaging a follow-up or tracking issue whose premise is that a prerequisite change "was already made", verify the prerequisite PR's real state before treating the follow-up as actionable. Do NOT trust the issue's past-tense framing — even a bot-authored tracking issue can describe a not-yet-merged PR as done.

**Concrete case (shader-slang/slang#11919, 2026-07-02):** issue body said "In #11805, slang-test was changed to default compiler invocations to -O0" and asked to remove all explicit `-OX` opt-ins from `tests/**`. But **#11805 was still OPEN** (`reviewDecision=APPROVED`, `mergeable=MERGEABLE`, `mergeStateStatus=BLOCKED`, not merged). The `-O0`-default machinery was **absent at HEAD** — `tools/slang-test/slang-test-optimization-options.h` did not exist and slang-test-main.cpp had no default-append logic. So the whole follow-up is **strictly blocked on #11805 merging first**: dropping explicit `-O0` before the default lands would make those tests fall back to slangc's default optimization (spirv-opt ON) and break their expected FileCheck output.

**Cheap checks that caught it (do these every time):**
- `gh pr view <prereq> -R <repo> --json state,mergedAt,mergeCommit,mergeStateStatus,reviewDecision` — is it actually merged?
- Verify the machinery exists AT HEAD, not just in the PR diff: `ls` the file the PR adds, or `grep` for the logic the PR introduces. Absence at HEAD proves the premise is false regardless of what the issue text claims.
- Note that the prereq PR itself often edits many of the same files (#11805 touches ~42 test files), so any survey must be re-taken against the post-merge tree.

**Reusable domain fact for slang-test opt-level cleanup:** `-O0` == `SLANG_OPTIMIZATION_LEVEL_NONE` makes `glslang_optimizeSPIRV` (slang-glslang.cpp) return immediately, skipping ALL spirv-opt passes → emitted SPIR-V is Slang's own unoptimized output. `-O1`=DEFAULT passes, `-O2/-O3`=HIGH/MAXIMAL passes. Therefore, under a `-O0` slang-test default: an explicit `-O0` on a `-target spirv … -O0` FileCheck test is REDUNDANT (dropping it is output-neutral → bulk-droppable); but `-O1/-O2/-O3` tests (esp. `filecheck=CHECK_OPT`, e.g. tests/spirv/debug-struct-member-values*) genuinely pin optimized output and are opt-sensitive → keep-with-documented-reason or rework FileCheck to not pin spirv-opt output. Also: slang-test's default needs two spellings (bare `-O0` direct, `-Xslang -O0` render-test), and Metal render tests default to `-Xslang -O1` (level unused by Slang IR but selects the downstream metal-toolchain flags; -O0 caused macOS CI flakes).

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783029023011-follow-up-tracking-issue-premise-can-outrun-its-pr.md`_
