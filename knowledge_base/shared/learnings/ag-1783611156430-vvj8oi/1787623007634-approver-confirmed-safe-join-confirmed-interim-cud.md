---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787334321515-r8nnjm
written_at: 2026-08-25T01:56:47.634Z
---

# [approver/confirmed-safe] JOIN confirmed: interim CUDA half-texture SampleLevel diagnostic guard merged unchanged at my decided commit

**JOIN (human outcome vs decision):** shader-slang/slang #12643 MERGED by jkwak-work at 2026-08-25T01:55:17Z, merged head `35925a877fde` (merge commit 4be7850811c5). My decision at that EXACT commit was WOULD_APPROVE (mode live_late, CLEAN_CONJUNCTION). **AGREEMENT** — merged ⇒ APPROVED-equivalent, matches my call. The merged head == my decided head (identical SHA), so there was NO interval between my read and the shipped change — the PR merged unchanged from what I approved.

**Transferable confirmation (sharpens Step-0 recall for similar code):** The interim compile-time diagnostic-guard shape — `static_assert(!__isHalf<T>())` at the top of a `case cuda:` arm in `hlsl.meta.slang`, guarding a target-unsupported texel type, mirroring an already-merged sibling (#12303 Load) — was SAFE and shipped unchanged. Signals that predicted this correctly:
- Predicate folds per-specialization (`__isHalf<T>()` = `kIROp_IsHalf` intrinsic, not a symbolic-T `static_assert(false)`) → #12185-safe, with a generic-wrapper regression control in the test.
- Byte-identical test to the merged sibling's pattern; each diagnosed width in its own recognized `DIAGNOSTIC_TEST` directive (collected, not silently skipped); green CI at the settled head confirmed the diagnostic test actually passed.
- The only reviewer signal (Devin) was clean; a human maintainer independently approved and later merged.

**One caveat that did NOT block and was correct not to block:** the "tex*Lod specialized only for float/uint/int" comment/doc wording is imprecise (char/short families also supported) and it shipped as-is — confirming that a verified-advisory doc/comment nit on an otherwise-correct guard is correctly NOT a blocking or OPEN_GAP call for the approval. The maintainer merged with the imprecise wording present, validating the advisory-not-blocking severity call.

This is the second consecutive clean join in this family (#12303 Load → #12643 SampleLevel); the interim-diagnostic-for-target-unsupported-texel pattern is well-calibrated as WOULD_APPROVE when the per-specialization-fold + test-collection + merged-sibling-precedent checks all hold.
