---
title: "Verify the cited fix-PR is an ancestor of the reporter's build before accepting regression/incomplete-fix framing"
type: learning
topic: ci-tooling
source: learnings/1780648573408-verify-the-cited-fix-pr-is-an-ancestor-of-the-repo.md
---

# Verify the cited fix-PR is an ancestor of the reporter's build before accepting regression/incomplete-fix framing

**Rule:** When a triage memo says "still broken despite PR #N" or frames a bug as a regression/incomplete fix, FIRST run `git merge-base --is-ancestor <fixPR-merge-commit> <reporter-or-triage-build-commit>` before writing any compiler change. If it returns false (non-zero), the cited fix was NOT in the build that reproduced the bug — the symptom is the *pre-fix* defect that the existing PR already resolves, and the correct deliverable is regression-test coverage, not a new fix.

**Why:** slang#11483 was triaged P1 as a SIGSEGV during SPIR-V emission for `ConstantBuffer<T>` via `spvDescriptorHeapEXT`, with the memo asserting PR #11211 was an "incomplete fix." But `#11211 (aaa5f89dd)` is not an ancestor of the triaged commit — it merged *after* the reporter built. So the crash was the original pre-#11211 defect, already fixed on master. Had I trusted the framing I'd have written an unnecessary (and likely wrong) compiler change. Verified the wrong-data symptom too: descriptor-heap path emits byte-identical OpDecorate/OpMemberDecorate layout to a bound `[[vk::binding]]` CB and passes spirv-val → no compiler emission/layout defect on master.

**How to apply:** Get the reporter's build via their `slangc -v` / `git describe` in the issue. Get the fix-PR's merge commit (`gh pr view N --json mergeCommit`). `git merge-base --is-ancestor FIX BUILD; echo $?` — 0 = present, 1 = absent. Absent → deliver a regression test (cover the *specific* shape the reporter hit, not a simplified one — codex flagged a simplified struct as under-coverage) + a PR that attributes resolution to the existing PR and uses "Relates to #N" (no auto-close). Disclose any GPU-free verification gap.

**Bonus facts (slang):** shader-slang/slang default branch is `master`, not `main` (workflow templates say `main` — wrong). For a std140 array-of-matrix constant-buffer member, `MatrixStride 16` is decorated on a generated wrapper type `%_Array_std140_matrix_float_4_4_4` (member 0) and `ArrayStride 64` on the named matrix array `%_arr_mat4v4float_int_4`, NOT as `OpMemberDecorate <block> <idx> MatrixStride` — pin the named wrapper/array types in FileCheck.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780648573408-verify-the-cited-fix-pr-is-an-ancestor-of-the-repo.md`_
