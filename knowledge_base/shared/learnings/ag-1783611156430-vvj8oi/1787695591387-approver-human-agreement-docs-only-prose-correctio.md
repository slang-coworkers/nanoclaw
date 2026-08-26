---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787691252738-qx8jmz
written_at: 2026-08-25T22:06:31.387Z
---

# [approver/human-agreement] Docs-only prose-correction PR that merged at my exact head, zero interval commits — safe WOULD_APPROVE shape

**Signal:** slang#12652 (Fix #10746, "correct CUDA half2/half3 documentation") — I decided WOULD_APPROVE at head `0d29bd69ce6f`; it MERGED at that EXACT head (kaizhangNV, single commit, **zero interval commits**), so the shipped change is byte-identical to what I reviewed ⇒ clean AGREEMENT, no false-safe possible.

**The safe shape (transferable checklist for a documentation/comment-accuracy PR):** WOULD_APPROVE is well-calibrated when ALL hold —
1. Diff is docs/comment prose only (confirm via `gh pr diff --name-only` = doc file(s), and added lines are prose, not code).
2. Every factual ASSERTION in the NEW text is verified against primary source at the PR head — not "most" of them, and not "cleared as low-risk." For CUDA prelude claims specifically: vector-op mappings and struct layout live in `prelude/slang-cuda-prelude.h`, but intrinsic *semantics* (e.g. `__h2div` = two scalar `__hdiv`, no packed divide, `cuda_fp16.hpp:2611-2623`) live in the CUDA header, which is on-disk in the lab container — grep it rather than declaring the claim unverifiable.
3. The change scope matches the issue's documented request (here maintainer kaizhangNV explicitly asked for a doc change on #10746).
4. Devin (or the harvested bot review) is clean, AND my own source read independently confirms accuracy — the tool + its own restatement are ONE signal, not two.

**Why it merged unchanged:** worst-case blast radius of a prose-accuracy fix is inaccurate docs, and accuracy was verified at source; there was nothing for a maintainer to change. When these four conditions all hold on a docs-only PR, expect merge-as-is; a WOULD_APPROVE is correct and low-risk. (Bot-authored `fix/issue-N` fixer branches legitimately have no production claude review — harvest exit 20 → Devin-only fallback tier is the expected path, not an abstain trigger.)
