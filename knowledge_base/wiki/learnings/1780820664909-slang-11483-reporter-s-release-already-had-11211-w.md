---
title: "slang#11483: reporter's release already had #11211 — wrong-data is a distinct OPEN defect, not the fixed crash"
type: learning
topic: slang-compiler
source: learnings/1780820664909-slang-11483-reporter-s-release-already-had-11211-w.md
---

# slang#11483: reporter's release already had #11211 — wrong-data is a distinct OPEN defect, not the fixed crash

**Context:** slang#11483 (spvDescriptorHeapEXT reads nested `float4x4[4]` UBO member incorrectly). Two prior bot positions existed: (a) "SIGSEGV on HEAD" — later corrected as a stale pre-#11211 build; (b) the correction + PR #11484 "predate #11211 / already resolved by #11211." An independent re-investigation (2026-06-07, HEAD 5230a81f2) found **both** are wrong.

**The non-obvious correction (verify ancestry against the REPORTER'S build, not just HEAD/triage build):**
- `git merge-base --is-ancestor aaa5f89dd v2026.10.2` → **YES**. #11211 (`aaa5f89dd`) is in the reporter's *release* (v2026.10.2, cut 2026-06-02; #11211 merged 2026-06-01). So "the reporter predates #11211" is FALSE.
- #11211 fixed a **crash** (#11037). The reporter reported **wrong data**, never a crash. These are **two different defects**. #11211 resolving the crash says nothing about the miscompile. Don't let a fix-PR for symptom X be cited as resolving symptom Y on the same issue.
- Therefore "update to a build with #11211 and retest" is **moot** — the reporter is already on such a build, and master emits byte-identical SPIR-V to it.

**Why static proof can't close it:** heap-path SPIR-V is byte-identical to the working bound `[[vk::binding]]` path in all member addressing (member offset 384, ArrayStride 64, MatrixStride 16); passes spirv-val; source review (`emitDescriptorHeapLoad` slang-emit-spirv.cpp:7165) confirms the in-buffer array stride comes from the *shared* type-layout path, untouched by descriptor-heap code (the only heap-specific stride is the inter-descriptor stride, #10265/#10297). The ONLY delta is base pointer `OpBufferPointerEXT` vs `OpVariable`. So Slang emit looks correct → symptom is most consistent with an NVIDIA-driver defect indexing a nested array through an `OpBufferPointerEXT`-derived pointer; a latent buffer-pointer stride-encoding gap (ArrayStrideIdEXT?) that spirv-val won't flag can't be excluded without hardware.

**Rule:** When a comment/PR claims "already fixed by PR #N," check `git merge-base --is-ancestor <N-merge-commit> <reporter's exact release tag>`, AND check that #N's symptom (e.g. crash) is the SAME symptom the reporter reported (e.g. wrong data). A GPU-free "byte-identical layout + spirv-val pass" never refutes a runtime-only/driver symptom — keep the issue OPEN pending a hardware retest framed as "retest the wrong-data case," not "update for the crash fix." (Reinforces the existing "verify the cited fix-PR is an ancestor" learning with the reporter-release + symptom-match dimensions.)

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780820664909-slang-11483-reporter-s-release-already-had-11211-w.md`_
