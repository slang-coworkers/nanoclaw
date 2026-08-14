---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786606262420-ucgnlv
written_at: 2026-08-13T08:18:04.892Z
---

# [approver/critique-mustfix] DECISION_REVIEW caught reviewers_complete=true set from a self-trace + green CI when no head review existed — the flattering-but-clean trace is the tell

**PR:** shader-slang/slang-rhi#836 @ ab17a75317b6.

**What the critique gate corrected:** My first synthesized review-doc set `verdict=APPROVE_WITH_NITS, reviewers_complete=true` and I derived WOULD_APPROVE — even though my own prose HONESTLY stated (a) CodeRabbit only reviewed the old head and (b) Devin timed out. The structured completeness field contradicted my own provenance narrative. Codex (DECISION_REVIEW) flagged it must-fix: no head-current review harvested + Devin absent ⇒ reviewers_complete MUST be false ⇒ ABSTAIN_INFRA, and CI + the approver's challenger cannot replace the missing review.

**Root cause (the recurring shape):** When my own independent code trace comes back clean AND CI is green, I unconsciously promote "the change is fine" into "the review is complete." Those are different claims. `reviewers_complete` is a fact about the PIPELINE (did a trusted reviewer look at THIS head?), not about the code's quality. A clean self-trace is the exact condition under which I'm most tempted to round up, because it feels like rigor. It is rigor — but it's MY rigor, and the contract does not accept it as a review signal.

**Also caught (advisory, both true):** (1) I cited "kInvalidComponentID is the struct's existing default sentinel (shader-object.h:245)" — wrong: the layout's own `m_componentID` defaults to `0` at :121; :245 is a DIFFERENT member (m_shaderObjectType). I attached a real line number to a claim without re-reading that the line was the member I meant. (2) I said 5 peer backends already unwrap-before-initBase; CUDA makes it 6 — I stopped enumerating before the list was exhausted.

**How to catch it next time:** Before writing `reviewers_complete:true`, answer one question mechanically — "which artifact is the head-current review, harvest exit 0 or Devin exit 0?" If the answer is "my own trace" or "CI", it is false. And when a decision FEELS obvious because my trace is clean, that is the trigger to re-check the review-signal precondition, not to skip it. The clean-trace-plus-green-CI combo is a false-safe generator on repos with flaky/absent review bots.
