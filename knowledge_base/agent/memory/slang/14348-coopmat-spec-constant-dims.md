---
type: chain
title: slang#14348 — CoopMat rejects specialization constants as matrix dimensions (E39999) on SPIR-V
description: External (zainsharief) 11-05. TRIAGED 13:29Z feature-request/medium/P2. The rejection is deliberate (PR #7855). PARKED on maintainer direction (csyonghe); no fixer.
resource: raw/triage-14348.md
tags: [coopmat, specialization-constant, generics, spirv, feature-request, parked]
---

# slang#14348 — CoopMat spec-constant dimensions

- **Filed** 2026-11-05 13:16Z by zainsharief (author_association NONE). It was unassigned and unlabeled at dispatch, there were no memory hits, and no duplicate was found. It went to slang-triager on `gh-issue-shader-slang/slang-14348` at once (R6).
- **Triage** posted 13:29Z by nv-slang-bot (cmt 6659227581). Afterwards the issue has label `reproduced` and Type=Feature. Repro on master 04d2726db.
- **Root cause (verified by me 11-05).** `TryCheckGenericOverloadCandidateTypes` (`source/slang/slang-check-overload.cpp:306-313`) folds explicit generic value args with `ConstantFoldingKind::LinkTime`. Only `isArrayDecl` (the array magic type) gets `SpecializationConstant`. PR #7855 (csyonghe, merged 2025-07-22, titled "Fix Conditional<T, false> fields with a semantic.") added that rule and `tests/spirv/spec-constant-generic.slang`. It narrowed PR #7121 (kaizhangNV, merged 2025-05-15, "Implement spec const for generic parameter"). Because of this rule, `S<N>` and `vector<float,N>` fail the same way; the problem is not specific to CoopMat.
- **Triager findings (not re-verified):**
  - The reporter's SPIR-V claim is true: SPV_KHR_cooperative_matrix accepts OpSpec* for Rows/Columns, and spirv-val passes.
  - Side find: generic *inference* already binds a spec const, as in `sum<let K>(float a[K])` called on a spec-const-sized array.
- **Options:**
  - **A** — exception for CoopMat M/N only. Also needs: SPIR-V emit passes the operand through (`slang-emit-spirv.cpp:2712-2720`, now an unchecked `static_cast<IRIntLit*>`); a relaxed MulAdd literal check (`slang-ir-metadata.cpp:676-687`); clean diagnostics on HLSL/CUDA/Metal. Recommended if approved.
  - **B** — restore #7121 for all generics. Not recommended.
  - **C** — keep the rule, make the diagnostic clearer, document the workaround.
- **State: PARKED** on maintainer direction (csyonghe, named in the comment without an @-mention). Fixer dispatch is an operator decision. Triager one-shot re-check `i14348-recheck-dc7b` at 2026-11-12 14:00Z (triager-reported; it is in the triager's group, so my `ncl tasks` can't see it).
- **11-05 13:33Z** reported to the operator on the dashboard (seq 511334) and asked whether to @-mention csyonghe. No answer as of 11-06 17:01Z.
- **11-06 17:00Z** jkwak-work @nv-slang-bot (cmt 6690526745) asked: "Did you mean that if we support this feature, it will be similar to reverting PR 7855?" No sibling had forwarded it. RELAYED to the triager owner session `sess-1793884696914-x50g5m` on `gh-issue-shader-slang/slang-14348`, post authorized, to answer on the issue.
- **11-06 17:08Z** the triager answered jkwak-work (cmt 6690680173, nv-slang-bot; codex output review approved in round 2). A is not a revert of #7855: A keeps the arrays-only rule and adds only CoopMat rows/cols on SPIR-V, while B is close to a revert. "Today" results were checked on master fef74e3c6. **PARKED on jkwak-work's choice** (A / C / other). If A, fixer dispatch is the operator's decision. Re-check 11-12 14:00Z is unchanged.
