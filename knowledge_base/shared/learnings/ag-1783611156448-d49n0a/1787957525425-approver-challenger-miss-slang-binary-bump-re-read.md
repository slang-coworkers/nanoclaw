---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1787955704375-2z69rf
written_at: 2026-08-28T22:52:05.425Z
---

# [approver/challenger-miss] Slang binary bump: re-read PR reviews at decision time and check the slang-rhi submodule pin for version-coherence

**Context:** shader-slang/slangpy#1128 "Update Slang to 2026.16.1" — a 1-line
bump of `SGL_SLANG_VERSION` in `external/CMakeLists.txt`. Decided
ABSTAIN_POLICY:OPEN_GAP (live, v0-shadow-wide).

**Symptom / near-miss:** The derivation was tracking cleanly toward WOULD_APPROVE
— 6/6 clauses pass, no bot review (CodeRabbit skips `external/**`), Devin clean,
and the decisive positive control (12/12 cross-platform builds green at head) was
satisfied. It was about to be recorded as WOULD_APPROVE. The blocking signal — a
maintainer's COMMENTED review — had been posted at 22:36Z, ~14 min AFTER the PR
was staged at 22:22Z, so the initial "reviews" fetch (empty) missed it. It only
surfaced because the OUTPUT_REVIEW codex critique re-read the live PR at
decision/send time and flagged the new human review.

**Root cause (two compounding):**
1. **Staged-state staleness.** The reviews/comments snapshot is taken once at
   staging; on a fresh reviewable PR a human review can land minutes later, during
   your own investigation. A one-time fetch is a point-in-time read of a moving
   surface.
2. **CI-green answers the wrong question for a compiler-binary bump.** A green
   build is a positive control that 2026.16.1 *downloads/links/compiles*. It does
   NOT prove *version-coherence* between slangpy's two independently-pinned slang
   dependencies: the downloaded `SGL_SLANG_VERSION` compiler binary AND the bundled
   `external/slang-rhi` git submodule. The maintainer (jhelferty-nv) asked exactly
   this — "should we bump slangpy's slang-rhi pin? looks ~37 commits behind what's
   in slang 2026.16.1." Verified the gitlinks genuinely differ: slangpy@head
   `external/slang-rhi`=22239042… vs slang@v2026.16.1 `external/slang-rhi`=d6d31411….
   A build can pass on a stale-but-compatible slang-rhi while a latent runtime/ABI
   mismatch remains.

**How to catch it next time (both are cheap diff/metadata reads):**
- **Re-read PR reviews + comments immediately before recording**, not only at
  staging — a human review submitted after you staged is a live inbound that can
  flip the decision. Treat any post-staging human COMMENTED/CHANGES_REQUESTED
  review raising a substantive question as an OPEN_GAP unless it's clearly resolved.
- **For any slang compiler-version bump in slangpy, diff the `external/slang-rhi`
  submodule pin against the slang release's own `external/slang-rhi` pin** (both
  are one `github_get_file_contents` read of the gitlink SHA). If they diverge and
  nobody has addressed it, that's a completeness OPEN_GAP the build cannot clear —
  the bump may be only half-done. Don't adjudicate the exact ahead/behind count or
  whether the coupling is required (maintainers own that); the divergence + an
  engaged human questioning it is enough to abstain.

**Fix / disposition:** ABSTAIN_POLICY:OPEN_GAP is conservative-correct here — no
🔴 (not BLOCK), but a plausible-real completeness gap directly questioning whether
the PR achieves its stated purpose, raised by an engaged maintainer who owns
resolution. This is the same version target (2026.16.1) and same file as the prior
slangpy#1127 challenger-miss; the lesson generalizes: on dep-version bumps,
"builds green" ≠ "update is complete/coherent."
