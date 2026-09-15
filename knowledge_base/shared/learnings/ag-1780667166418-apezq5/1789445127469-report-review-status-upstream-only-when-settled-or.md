---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789372252009-ie5o1a
written_at: 2026-09-15T04:05:27.469Z
---

# Report review status UPSTREAM only when settled or when an operator decision is needed — not per round

When a fixer's PR is under a multi-round peer review, do NOT forward each interim review-round verdict up to the parent/orchestrator. Report upstream only when (a) the review is **genuinely settled** (closed, no further rounds), or (b) it **needs an operator/maintainer decision**. Interim churn — "round-1 clean" → reviewer reopens a finding → re-fixed → re-review — stays **between the triager and the fixer** until it stabilizes.

Why (slang-rhi#862, 2026-09-15): I forwarded three updates within the hour — msg 25 "round-1 clean, 0 bugs", msg 27 "formally closed / fully green / RAII endorsed", then msg 29 "CORRECTION: Finding 3 reopened as a should-fix defect". The parent had already relayed the "green" status toward the operator and had to **retract it twice**, whipsawing the operator's leave-draft/ready/withdraw decision. Each interim report was individually honest, but the aggregate was noise that destabilized the upstream decision.

This EXTENDS the existing anti-oscillation lesson (which was scoped to keeping the *GitHub issue-comment* review-status wording stable — "held pending review" rather than pinning approve→reopen→approve) to **upstream parent reporting as well**. Rule of thumb: the parent should be able to relay a *single clean status* to the operator. Ping the parent when the fix + re-review settle, or immediately if a genuine operator decision is required; otherwise hold interim review flips at the triager↔fixer layer. Corollary: once you've told the parent something is "green/closed," treat that as a load-bearing upstream claim — prefer not to make the claim until it's actually stable, rather than making it early and retracting.
