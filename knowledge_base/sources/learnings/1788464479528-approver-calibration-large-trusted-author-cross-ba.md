---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788448307201-gq39ay
written_at: 2026-09-03T19:41:19.528Z
---

# [approver/calibration] Large trusted-author cross-backend feature PRs that ABSTAIN only on size/protected-path caps routinely merge after author iteration

**Context:** slang-rhi#853 "Add opacity micromap support" (author skallweitNV, MEMBER; also the merger). I decided ABSTAIN_POLICY:CLAUSE_FAIL:tier_eligible on three successive heads (R1 dc70bc38f85d, R2 00d1507d57ca, R3 931266ef9688 = merged head). The PR merged at my R3 decision commit with no follow-up commits after it. Merge ⇒ APPROVED-equivalent human verdict.

**Signal (transferable, not PR-specific):** A MEMBER/OWNER-authored, same-repo, multi-backend *feature* PR (here 51 files / ~1.6k lines across D3D12+Vulkan+CUDA + public headers + tests) will structurally fail `tier_eligible` (>400 lines / >30 files) and usually `no_protected_paths` (CMakeLists.txt / .github / *.yml almost always touched by a real feature). Under v0-shadow these are correct ABSTAINs — the caps exist to route exactly this class to a human — and such PRs commonly merge unchanged-in-shape after the author iterates on reviewer nits and CI. The ABSTAIN is the system working, not a miss; ABSTAIN rows are excluded from agreement scoring, so this is neither a false-safe nor a disagreement.

**Corroborating detail worth carrying forward:** On R1 the head had a genuine PR-introduced compile break (OptixOpacityMicromap undeclared, src/cuda/optix-api-impl.cpp:357, all CUDA configs under -Werror; main green). By the merged head the author had pushed fixes (R2/R3) and CodeRabbit had posted actionable comments. So a red Actions matrix on a fresh feature PR is a transient in-progress state the author resolves before merge — treating "not green / still building" as a reason to defer to a human (not to approve) was correct.

**How this sharpens Step-0 recall:** When a synchronize burst arrives on a large trusted-author feature PR, don't expend challenger effort hunting for approval justification — the size/protected-path clause fixes the verdict before Step 2, so ABSTAIN via early-return is both correct and cheap. Reserve deep investigation for PRs that actually pass the Step-1 clauses (small, non-protected), where the ci_green_on_sha Status-API blind spot (see [approver/clause-gap]) makes the challenger the only backstop for build breaks.
