---
title: "PR #12200 RayQuery-return NRVO review — APPROVE_WITH_NITS, 0 bugs"
type: learning
topic: review-process
source: learnings/1784882737937-pr-12200-rayquery-return-nrvo-review-approve-with-.md
---

# PR #12200 RayQuery-return NRVO review — APPROVE_WITH_NITS, 0 bugs

shader-slang/slang#12200 (Closes #12197, SS/P1 silent SPIR-V miscompile: RayQuery returned by value disconnects OpRayQueryInitializeKHR from OpRayQueryProceedKHR → VK_ERROR_DEVICE_LOST on Vulkan/NVIDIA, clean on DXIL). Fix = scoped NRVO in slang-lower-to-ir.cpp: alias the named-return local to the return-destination out-param so the opaque handle builds in place.

3-reviewer verdict: **APPROVE_WITH_NITS, 0 bugs** (A: 0 bugs/4 gaps→3 live; B Devin: 0/0/0 clean; C clarity: 6 advisory; no A/B/C disagreements). Delivered via send_file to parent only (no github-post-authorized marker); operator-gated ready-flip pending.

Source-verified correctness crux (do this for P1 rather than only relaying reviewers):
- NRVO only elides a provably-no-op whole-handle OpLoad/OpStore layered on the return-dest transform that ALREADY exists on master (maybeAddReturnDestinationParam). Gated strictly to RayQuery/HitObject via `isNonCopyableOpaqueType`, so it cannot regress the real by-value copy on DXIL/other targets.
- `findCommonReturnedLocalVar` (slang-lower-to-ir.cpp:4234) bails conservatively: trailing `else` sets ioBailed on any unrecognized Stmt; also bails on multi-return-to-different-locals, `defer`, and rejects let/static/param/global.
- 3 setup gates: `destIsNonCopyableOpaque && !anotherParamCouldAlias && !canThrow`.
- Shared `isNonCopyableOpaqueType` (slang-ir-util.cpp: unwrapArray → as<IRRayQueryType>()||as<IRHitObjectType>()) is behaviorally identical to the deleted lambda in slang-ir-specialize-resources.cpp.
- Primary test gh-12197-rayquery-return.slang captures init operand as [[Q]] and requires Proceed to reference same [[Q]] — the same-variable pin gh-10774-concrete-return.slang lacked. 3 guard tests assert NRVO OFF (init on callee's own OpVariable Function) at -O0.

Live gaps (all non-blocking): (1) anotherParamCouldAlias disables NRVO on ANY opaque-handle param, not the "same handle type" its comment claims — conservatively safe, comment/code mismatch; (2) NRVO var-decl branch skips maybeAddDebugLocationDecoration (debug-info only); (3) HitObject + multi-return/nested-return recursion untested. Nit: comments at L8970/L14330 say `visitVarDeclBase` but the branch is in `visitVarDecl` (L12051) — visitVarDeclBase exists only in slang-check-decl.cpp. Confirms [[rayquery-return-by-value-miscompile-opaque-value-c]]: this is the narrow front-end NRVO fix; the broader non-copyable-copy family (b=a, box.q=makeQuery()) + warning-vs-error diagnostic stays a deferred maintainer open-question, deliberately out of scope.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1784882737937-pr-12200-rayquery-return-nrvo-review-approve-with-.md`_
