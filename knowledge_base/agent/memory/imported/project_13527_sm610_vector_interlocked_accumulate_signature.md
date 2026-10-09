---
type: project
name: project_13527_sm610_vector_interlocked_accumulate_signature
description: "slang#13527 (jkwak-work, self-assigned, 10-08 17:49Z): SM 6.10 CoopVec prelude still calls dx::linalg::InterlockedAccumulate(vec, buf, off); hlsl-specs#892 / e53ca543 reordered it to (buf, off, vec) with Align as a template arg (default 64). Triaged 10-08 (cmt 6067287717, reproduced vs DXC main 75fba61): the reorder must land together with a DXC bump to a build containing DXC#8644, and no release has both SM 6.10 and the new header. 10-08 20:52Z jkwak opened his own PR #13532 (merge held until a DXC pre-release has SM 6.10 + the new signature): HANDED OFF, no bot work; re-chase watches #13532."
---

# slang#13527: SM 6.10 vector InterlockedAccumulate signature

**10-08 17:49Z, `issue_opened`.** I read the live state at 17:5xZ. It's open, human author `jkwak-work`,
self-assigned, no labels, and 0 comments. The live body matches the payload (4220 chars). The only session
on `gh-issue-shader-slang/slang-13527` is my own webhook session. No `ncl tasks` entry and no
`conversations/` entry cover it, and no open PR touches `InterlockedAccumulate`. The related open issue is
#11613 (CoopMat linalg APIs). The lineage is #10723, #11213, and #11348.

**Claim:** `source/slang/slang-emit-hlsl-prelude.cpp` `__slang_linalg_VectorAccumulate` emits the old
`(inputVec, buffer, offset)` order. The test `tests/cooperative-vector/training-hlsl-codegen.slang` pins
that order. The author says the mismatch has **not** been reproduced against DXC; it was found by reading
the upstream diff.

**Disposition:** maintainer-authored and self-assigned, so no fixer is dispatched
([[project_13505_slangpy_tests_cross_repo_flake_aggregate]], [[project_13499_decl_nesting_validation_to_semantic_check]]).
I dispatched `slang-triager` on the canonical thread to verify the claims (the prelude, the test, the
DXC/header version pinned in the repo, and whether it already ships the new signature), check the alignment
contract, post the 5-bullet, and open no PR.

**10-08 19:18Z, triaged** (Main checked the comment, labels, the `FetchDXC.cmake` pin and the prelude on origin/master). `slang-triager` posted
[6067287717](https://github.com/shader-slang/slang/issues/13527#issuecomment-6067287717) and added the `reproduced` label (Type=Bug).
It rates this bug / medium / P2 / target-emit. On DXC main, the old order fails with "no matching function" and the reordered call compiles
with validation on, emitting `linAlgVectorAccumulateToDescriptor(..., i32 64, ...)`. The v1.10.2605.37 preview does the reverse.
CI pins `v1.9.2602`, which rejects `cs_6_10`, so CI only text-checks SM 6.10 HLSL. That makes this future-proofing, not a live break.
- **Approach A (recommended):** reorder to `(buffer, offset, inputVec)` with the default Align=64; update `training-hlsl-codegen.slang:15`;
  document the 64-byte offset precondition on `coopVecReduceSumAccumulate`; refresh `reduce-sum-accumulate-sm610.slang` (drop `-Xdxc -Vd`,
  add `-Ibuild/dxc/include`). It lands together with a DXC bump that includes DXC#8644 (2fab3f17).
- Gating on `__DXC_VERSION_*` was rejected: the preview and main both report 1.10.0 and differ only in commit count.
- The 64-byte rule predates this change (SM 6.9 spec 0029). `Matrix::InterlockedAccumulate` is unaffected. There's no code overlap with #11613.
- Memo: `/workspace/inbox/a2a-1791487201733-doim5v/triage-13527.md`. Scratch: triager's `/workspace/agent/scratch-13527`.
- Blocker: a maintainer has to choose the DXC build. Re-chase task `rechase-13527-dxc8644-c133` runs 10-15 18:00Z (DXC release check + new human comments).

**10-08 20:52Z, `pr_mention` [6068839660](https://github.com/shader-slang/slang/issues/13527#issuecomment-6068839660), handed off.**
jkwak-work opened his own PR **#13532** at 20:43Z: branch `support-sm-6-10-nov-2026`, `Fixes #13527`, non-draft, `pr: non-breaking`,
11 checks passing at 20:5xZ. It reorders the prelude, updates `training-hlsl-codegen.slang`, documents the 64-byte alignment on
`coopVecReduceSumAccumulate` and the 128-byte alignment on `coopVecOuterProductAccumulate`, and fixes `reduce-sum-accumulate-sm610.slang`.
The comment says he checked SM 6.10 CoopVec/CoopMat output against ToT DXC: only the vector order needed an emission change. He will hold the
merge until a DXC pre-release has both SM 6.10 and the new signature. The live comment matched the payload (no edit) and mentioned nobody.
**Disposition: held, no dispatch and no bot post** (#13498/#13411 precedent: a maintainer comment that doesn't mention the bot). His PR
supersedes our Approach A. One detail went to the operator, not to GitHub: the PR's disabled DXIL directive still passes `-Xdxc -Vd`, and the
triager noted that would hide the `Align` validation once the test is enabled. Re-chase `rechase-13527-dxc8644-c133` was retargeted to
watch #13532 and the DXC release.

**10-08 21:08Z, `pr_mention` [6069079805](https://github.com/shader-slang/slang/issues/13527#issuecomment-6069079805).** jkwak-work marked the
issue "Blocked" until a DXC release package contains DXC#8644. The live comment matched the payload and mentioned no one. It restates the known
blocker. Held: no dispatch, no bot post; re-chase unchanged.

**Resume:** if a comment @-mentions nv-slang-bot (webhook). **Terminal** when #13532 merges or closes.
