---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1787955704375-2z69rf
written_at: 2026-08-28T23:21:31.239Z
---

# [approver/human-disagreement] slangpy slang-rhi pin lag on a compiler bump: maintainer-raised, maintainer-resolved "fine" — abstain was safe-direction, and this class is often a non-blocker

**Context:** shader-slang/slangpy#1128 "Update Slang to 2026.16.1" (1-line
`SGL_SLANG_VERSION` bump). I decided **ABSTAIN_POLICY:OPEN_GAP** @ ef886dbf833e.
Human outcome: **merged UNCHANGED at my exact commit** 43 min later.

**The two rationales (mismatch = abstain vs. approved):**
- *Mine (abstain):* maintainer jhelferty-nv left a COMMENTED review at 22:36Z
  questioning whether slangpy's `external/slang-rhi` submodule pin needed to bump
  to match slang 2026.16.1 (suspected ~37 behind). I verified the gitlinks
  genuinely differ (slangpy 22239042 vs slang@v2026.16.1 d6d31411). A green build
  proves compile/link, not version-coherence of the two independently-pinned slang
  deps. Uncertainty at decision time ⇒ abstain.
- *Human (approved):* the SAME maintainer who raised the question then submitted an
  APPROVED review at 22:57Z — "Looks fine to me." — 21 min after his own comment.
  kaizhangNV merged unchanged at 23:19Z. So the pin divergence was deemed
  acceptable WITHOUT any slang-rhi bump.

**Calibration takeaways (audit the exoneration too — don't over-update):**
1. **The abstain was the SAFE direction of error, not a false-safe.** Shadow mode's
   OPEN_GAP means "a human must look"; a human looked and resolved it. Deciding on
   the state at decision time (an actively-open maintainer question, genuinely
   uncertain coupling) was correct — you cannot predict the maintainer will say
   "fine" 21 min later. Do NOT flip this class to WOULD_APPROVE to chase agreement.
2. **BUT this specific technical class calibrates: a slangpy `external/slang-rhi`
   submodule pin lagging the slang release's own slang-rhi pin, on a compiler-binary
   bump, was judged a NON-BLOCKER by the maintainer without action.** slangpy's
   downloaded slang compiler (`SGL_SLANG_VERSION`) and its bundled slang-rhi
   submodule are versioned independently and do NOT have to move in lockstep for a
   routine bump. Still surface the divergence — it's a legitimate question — but
   recall that it frequently resolves "fine," so weight it as a question to flag,
   not evidence of a broken/incomplete PR.
3. **The decisive move that made this auditable was re-reading PR reviews at
   decision time** (the 22:36Z review landed AFTER staging at 22:22Z and was caught
   only by the OUTPUT_REVIEW re-read). Keep doing that; it's what turned a blind
   WOULD_APPROVE into a correctly-surfaced OPEN_GAP.

**Net:** conservative-correct in shadow mode; for enforcement, a maintainer-raised
question the maintainer themselves resolves quickly is a weak blocker — the signal
to watch is whether the resolution required a code change (here it did not: merged
unchanged).
