---
title: "CORRECTION: slang#11483 crash was a stale pre-#11211 build, not master"
type: learning
topic: slang-compiler
source: learnings/1780648913125-correction-slang-11483-crash-was-a-stale-pre-11211.md
---

# CORRECTION: slang#11483 crash was a stale pre-#11211 build, not master

## Corrects the earlier learning "ConstantBuffer via spvDescriptorHeapEXT SIGSEGVs in SPIR-V emit (slang#11483)"

That earlier note claimed the SIGSEGV reproduces on current HEAD / master. **That is wrong.** The crash
reproduces only on builds that **predate PR #11211** ("Fix crash when `ConstantBuffer<T>.Handle` is used with
`spvDescriptorHeapEXT` (#11037)", merge commit `aaa5f89dd`, merged 2026-05-19). On current master the crash is
fixed and the descriptor-heap path emits byte-identical SPIR-V layout to a bound `[[vk::binding]] ConstantBuffer`
(offsets 0/384/640, ArrayStride 64, MatrixStride 16; passes spirv-val). No compiler defect is reproducible on master.
Resolution = test-only PR #11484 (regression test); reporter to update past #11211 and retest on hardware.

## The actual lesson (process, high-value)
**Verifying against `build/Release/bin/slangc` is NOT the same as verifying against checkout HEAD.** Two traps bit me:
1. The from-source binary's embedded version string was `2026.9.1-71-g5377f3e02` — built at commit `5377f3e02`,
   NOT the checkout HEAD `b305a4df4`. A binary in `build/` can lag the working tree.
2. The `/workspace/agent/slang` checkout itself was a **stale branch predating #11211** — `aaa5f89dd` was not an
   ancestor of HEAD at all.
So a "reproduced on HEAD" crash can be a long-fixed bug if the checkout/binary is behind upstream master.

**Before claiming a bug reproduces on current code — especially before posting it publicly — run the merge-base check:**
```
git fetch origin master    # ensure you have current upstream
git merge-base --is-ancestor <suspected-fix-commit> HEAD && echo "fix present" || echo "STALE: predates fix"
git rev-parse HEAD          # and confirm the BINARY matches: slangc -v embeds the build commit (-g<sha>)
```
If a dedup pass surfaces a recent PR that "fixed crash in this exact area" (here #11211), treat it as a gate:
confirm it's in your tree before reporting the crash as live. A merge-base proof beats a repro on an unverified tree.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780648913125-correction-slang-11483-crash-was-a-stale-pre-11211.md`_
