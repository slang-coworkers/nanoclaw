---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786446315868-hske8q
written_at: 2026-08-11T15:53:34.614Z
---

# [approver/clause-gap] SUPERSEDES the #828 soft-spot learning: "untested" is not "unsafe" — run reachability on your OWN posited trigger before grading a gap material

**Supersedes** my earlier same-session learning "[approver/challenger-miss] Naming a soft spot is not discharging it" (slang-rhi#828). That learning concluded the ABSTAIN was the right call. **It was not** — I filed it mid-swing, at pass 2, before the arithmetic was checked. Final decision on #828 R1 was WOULD_APPROVE.

**The full swing.** WOULD_APPROVE (my Step-3) → ABSTAIN_POLICY:OPEN_GAP (after codex DECISION_REVIEW must-fix) → WOULD_APPROVE (after codex OUTPUT_REVIEW must-fix). The middle ABSTAIN was a FALSE abstain.

**Symptom.** The PR's stated purpose was fixing 12-byte RGB32 texture staging; the 12-byte-block × multi-subresource interaction had no positive control (existing RGB32 test is single-mip; new NPOT test is 4-byte). I graded that OPEN_GAP, reasoning "a block-size-specific off-by-one in the per-subresource padding would pass every test."

**Root cause.** I never checked whether that posited failure is *reachable*. It isn't: on Vulkan — the only backend that uses 12-byte offset alignment — RGB32 `rowPitch = width × 12` (row alignment 1 for non-depth), so every `sizeInBytes` is inherently a multiple of 12 and `calcAligned(sizeInBytes, 12)` is the IDENTITY. Zero padding across the whole mip chain; offsets 12-aligned by construction. There is no 12-byte padding arithmetic for an off-by-one to inhabit. The non-trivial padding branch (D3D12/512) IS exercised by the passing NPOT RGBA8 test.

**How to catch it.** A coverage gap is only OPEN_GAP if a wrong answer in the uncovered cell is (a) reachable on a supported path AND (b) produces a bad outcome. This is the conservative-lean bar's FIRST clause ("clears if the trigger is unreachable on the supported path") — apply it to the trigger YOU posit, not just to the PR's own claims. Compute the arithmetic of the uncovered cell before grading it material: here, ~10 lines of Python walking `getSubresourceRegionLayout` showed padding ≡ 0.

**Why it slid past.** The pass-1→pass-2 flip *felt* like rigour: heeding a critique and erring toward caution. But caution not grounded in a reachable failure is not conservatism — it's a false ABSTAIN that sends a human to write a test that can only pass by construction, and it inflates the infra/policy abstain rate the pipeline drives toward zero. "Untested" ≠ "unsafe." "The feature's central case has no test" ≠ "there is a bug there."

**Meta.** A learning filed mid-decision can capture the wrong conclusion; when a verdict is still swinging, date/pass-stamp the reasoning state and be ready to supersede. Both codex rounds were correct and necessary (one stopped me rounding up on a hand-wave; the other stopped me abstaining on a hand-wave) — the defect was mine for not computing the padding earlier.

**Companion nit:** I twice mis-reported the reproduced D3D12 offsets by omitting the 256-byte `rowPitch` alignment (`calcAligned2`). When citing reproduced numbers, walk the FULL layout path, not a simplified size model.
