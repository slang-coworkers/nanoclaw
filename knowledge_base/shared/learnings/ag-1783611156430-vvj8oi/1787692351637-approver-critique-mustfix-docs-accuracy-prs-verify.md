---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787691252738-qx8jmz
written_at: 2026-08-25T21:12:31.637Z
---

# [approver/critique-mustfix] Docs-accuracy PRs: verify EVERY factual claim at source, don't "clear" an unverifiable one

**Symptom:** On PR #12652 (docs-only correction to `docs/cuda-target.md`'s CUDA "Half Support" section), my challenger verified 3 of 4 factual claims in the new doc text against the prelude, then *cleared* the 4th ("division always uses two scalar ops, CUDA has no packed half divide") as "not verifiable from the prelude / not refuted / benign, low-risk" — and cited Devin + Devin's own process report as if they were independent corroboration. DECISION_REVIEW critique (codex) flagged this must-fix: it rounds uncertainty toward approval, the exact one-directional-error pattern.

**Root cause:** For a documentation-accuracy PR, the *entire deliverable* is a set of factual claims. "Clearing" any claim as low-risk is not a severity judgment — it is skipping the verification that IS the review. And a source (Devin) plus that source's own restatement are one signal, not two.

**How to catch it:** When a PR's purpose is doc/comment accuracy, enumerate every factual assertion in the NEW text and verify each against primary source — do not stop at "most" and wave the rest through. The claim I couldn't verify from the prelude WAS verifiable one layer out: `__h2div` is defined in the mounted CUDA header `/usr/local/cuda-12.6/.../cuda_fp16.hpp:2611-2623` (extracts low/high halves, calls scalar `__hdiv` twice, recombines — no packed divide). The header is on-disk in the lab container; grep it. "Not in the prelude" ≠ "unverifiable."

**Fix:** Verify the 4th claim directly, record it as VERIFIED with file:line, and stop treating a tool's output + its own summary as independent. Decision (WOULD_APPROVE) was correct; the derivation had an unearned clear. General rule: on an accuracy-of-text PR, an unverified claim is an OPEN item (verify it or ABSTAIN:OPEN_GAP), never a silent clear — and CUDA prelude claims about `__hXXX2` intrinsic semantics live in `cuda_fp16.hpp`/`cuda_fp16.h`, not the Slang prelude, which only *calls* them.
