---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786620508516-neoisd
written_at: 2026-08-13T15:24:07.446Z
---

# [approver/human-disagreement] CONFIRMED: slang-rhi gitlink-bump PRs are safe-to-approve when slangpy's own real-GPU CI is green on the pinned head

**Class of signal (transferable):** A slangpy PR whose entire diff is a one-line `external/slang-rhi` gitlink bump (160000 mode, `Subproject commit` hunk) is review-doc-blind — the bot review / Devin only see the pointer line, so their "0 bugs" is a **zero-bit** observation. The signal that carries real bits is slangpy's OWN CI on the pinned head, because `.github/workflows/ci.yml` runs `tools/ci.py` `unit-test` on self-hosted `nvrgfx-kernelvm-bridge` **real NVIDIA GPU** runners (windows msvc Debug+Release, linux gcc Debug+Release) + `test-examples` on the Release rows — which exercises kernel-gen → shader-object-layout → dispatch against the newly-pinned rhi.

**Outcome that confirmed it:** slangpy#1104 @7a1443af1cfa, bump `632b0aee4`→`e11c29cfa` (4 merged rhi commits: optix_coopvec SM9.0 gate, UB fixes, d3d12/vk/wgpu shader-object-layout fix, ASan/UBSan build+CI). I decided WOULD_APPROVE on the basis of 14/14 green pre-merge check-runs + a read of the 4 commit diffs. The author (skallweitNV, MEMBER) **self-merged** the PR mid-decision — an APPROVED-equivalent human verdict that **agrees** with the call. No false-safe.

**How to apply next time:** For a slang-rhi gitlink bump, (1) don't treat a clean Devin/bot read as evidence — it's zero-bit; (2) fetch the submodule commit range and read the diffs (per-commit file lists for attribution — see the sibling critique-mustfix learning); (3) make slangpy's real-GPU CI green on the *pinned head* the positive control; (4) bound the CI claim to the backends slangpy actually tests (D3D12/Vulkan/CUDA; NOT wgpu, cpu only as unit-tests touch it). Green real-GPU CI + a clean commit-range read on a MEMBER-authored bump with no slangpy-side open gap ⇒ WOULD_APPROVE is calibrated. Uncertainty about a specific changed branch that slangpy's suite would NOT exercise still routes to ABSTAIN_POLICY:OPEN_GAP.

**Caveat:** the `ci_green_on_sha` and `no_protected_paths` clause passes under `v0-shadow-wide` are policy-driven (require_ci_green:false; external/** stripped) — they do NOT substitute for independently verifying CI green and reading the range. Lean on the independent check, not the clause.
