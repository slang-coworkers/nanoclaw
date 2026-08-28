---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787852805731-i7x4gg
written_at: 2026-08-27T18:22:11.569Z
---

# [approver/critique-mustfix] Fallback-tier review doc must synthesize the SOURCE verdict; the approver's refutation goes in the challenger, not the prior

**Symptom (slang-rhi#846, WOULD_APPROVE):** I synthesized `review/review-doc.md` on the fallback tier (CodeRabbit + Devin, no prod bot) with verdict `APPROVE_WITH_NITS` and gaps=0 — because I had *already* refuted CodeRabbit's one 🟠 Major finding ("both backends ignore the result of `StagingHeap::initialize(...)`") inside the doc itself. DECISION_REVIEW critique flagged this must-fix.

**Root cause:** The `/slang-pr-approve` workflow's fallback mapping is explicit — a 🟠 / "potential bug" / "blocking" finding maps to **REQUEST_CHANGES**; only-nits maps to APPROVE_WITH_NITS. The synthesized doc is the *prior* that Step-2 parses and Step-3 (the challenger) reconciles against. If I fold my refutation back into the doc, the prior and the challenger are the same voice → the independence between "what the source reviewer said" and "what I concluded after investigating" collapses. The doc must faithfully carry the source signal (🟠 ⇒ REQUEST_CHANGES, mapped as a non-🔴 **gap**, since it's a refactor_suggestion, not a verified 🔴 bug), and my refutation belongs ONLY in `investigation.md` (the challenger), which then clears the non-🔴 gap on the conservative-lean severity bar and derives the final decision.

**How to catch it:** When synthesizing a fallback-tier doc, ask: "Am I letting my own analysis lower the verdict the *source reviewer* actually expressed?" A bot's 🟠/🟡 severity label is the source signal — transcribe it into the embedded `_approver_result` verdict per the mapping, THEN reconcile in the challenger. The final decision can still be WOULD_APPROVE after the challenger legitimately clears a non-🔴 finding; what's disallowed is pre-clearing it in the prior. The refutation being *correct* (codex agreed the technical refutation was sound — `initialize` returns void, failures propagate via `SLANG_RETURN_ON_FAIL`) does NOT license putting it in the doc.

**Fix:** Two-file separation, always: (1) `review-doc.md` = source verdict, conservatively mapped, refutation-free; (2) `investigation.md` = the challenger's own reasoning that clears/keeps each non-🔴 gap. This keeps Step-2 parse and Step-3 challenger genuinely independent, which is the whole point of the two-step design.

**General class:** Related to the over-conservative slang-rhi streak (#819) — the *decision* still lands WOULD_APPROVE when the finding is a bot hallucination, but the *paper trail* must show the source flagged it and the challenger, not the synthesizer, cleared it.
