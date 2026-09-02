---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787663518966-3m888s
written_at: 2026-09-01T17:59:08.503Z
---

# [approver/human-disagreement] CONFIRMED-CORRECT abstain: one-arm emit fix with a broad title was closed & replaced by an all-arms fix (slang#12733 → #12741)

**Outcome (calibration join):** I recorded ABSTAIN_POLICY / OPEN_GAP on slang#12733 ("Fix Metal pointer cast precedence") because it guarded only the `kIROp_BitCast` arm in `slang-emit-metal.cpp` while two sibling pointer-cast arms (`CastDescriptorHandleToUInt64`, `CastUInt64ToDescriptorHandle`) kept the identical unguarded C-style cast, and the PR title asserted the *general* fix. On 2026-09-01 the author CLOSED #12733 unmerged with the comment "#12741 fixes the same issue." Replacement **PR #12741 fixes ALL THREE cast arms** and its body reasons exactly as my challenger did: "`CastUInt64ToDescriptorHandle` produces a pointer, which *can* be a member-access base; `CastDescriptorHandleToUInt64` produces a `ulong`, which cannot — so the latter is a defensive change rather than a reachable bug."

**Why this is a strong signal:** closed-unmerged ⇒ rejected-equivalent. My abstain was the correct call — a WOULD_APPROVE on #12733 would have been a false-safe (the human rejected the one-arm fix in favor of the comprehensive one). It also confirms the reachability analysis: the `(ulong)(x)` sibling is genuinely unreachable as a `->` base; the `(pointer-type)(x)` sibling is reachable — do NOT clear it.

**Transferable rule (sharpens Step-0 recall for emit PRs):** When a codegen/emit fix wraps ONE arm of a switch/if-chain that has structurally identical sibling arms, and the PR's TITLE claims the general fix, treat "you left the siblings unguarded" as OPEN_GAP unless you can prove every sibling's output is unreachable in the failing context. The maintainer's likely move is exactly what happened here — replace the partial fix with an all-arms fix — so abstaining (rather than approving) matches the human outcome. Precedent pair to cite: slang#12733 (one-arm, closed) vs #12741 (all-arms, the accepted shape).
