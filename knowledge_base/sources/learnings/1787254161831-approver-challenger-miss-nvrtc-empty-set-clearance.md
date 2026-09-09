---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787252601504-evr6bh
written_at: 2026-08-20T19:29:21.831Z
---

# [approver/challenger-miss] NVRTC empty-set clearance rested on an unverified "not a real state" premise

**PR:** shader-slang/slang#12649 @0aa14f7b6b30 ("Ask NVRTC which architectures it supports instead of assuming"). Decision: ABSTAIN_POLICY(OPEN_GAP).

**Symptom.** I first cleared the single residual 🟡 gap (`_getSupportedArchs` folds `numArchs<=0` into `SLANG_E_NOT_AVAILABLE`, which the PR's own doc-comment says must stay distinct from "empty list") to WOULD_APPROVE, on the pillar "empty is not a real NVRTC state, so the trigger is unreachable." The DECISION_REVIEW critique (codex) returned MUST-FIX; I verified against authoritative NVRTC docs (docs.nvidia.com/cuda/nvrtc) — they give **no guarantee** `nvrtcGetNumSupportedArchs` returns a positive count, and a documented CUDA lld/mold-link defect can return 0. CodeRabbit independently raised the same non-guarantee. So the trigger is documented-reachable, not unreachable.

**Root cause.** I treated an API's *typical* behavior ("it always reports some archs") as a *guaranteed* invariant, then used that unverified premise to declare a reviewer-flagged gap's trigger unreachable. The runtime blast radius genuinely IS safe (caller also gates `getCount()>0`; resolver passes through on empty → falls back to the version ladder byte-identically to pre-PR), and that safe-fallback fact is real — but "safe outcome" is not "unreachable trigger," and the conservative-lean bar keys on trigger reachability, not just blast radius.

**How to catch it.** When clearing a gap on the grounds "this input state can't happen," name the SOURCE of that guarantee and check it — an API-contract claim ("the count is always positive", "this pointer is never null", "the list is never empty") must be read out of the vendor docs/header, not assumed from how the API usually behaves. If the docs don't promise it, the trigger is reachable and the gap does not clear. Three signals converged here (production bot 🟡, CodeRabbit outside-diff comment, codex MUST-FIX) all on the exact spot the PR's own comment declared "must stay distinct" — a gap the author themselves documented as a real distinction is a strong OPEN_GAP prior.

**Fix (transferable rule).** A gap on a code path the PR's own comments call out as a meaningful distinction, whose no-trigger clearance rests on an unstated API guarantee, is OPEN_GAP unless the guarantee is found in the docs. "Runtime is safe anyway" lowers severity but does not clear a documented-reachable trigger on a stated contract. And: verify a must-fix critique's factual claim (here: the zero-count reachability) against the primary source before either accepting OR dismissing it — the correction was right, but I confirmed it rather than deferring.
