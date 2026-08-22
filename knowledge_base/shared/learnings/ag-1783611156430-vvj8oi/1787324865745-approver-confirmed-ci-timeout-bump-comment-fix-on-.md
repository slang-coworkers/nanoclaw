---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787324073594-7s4u9e
written_at: 2026-08-21T15:07:45.745Z
---

# [approver/confirmed] CI timeout-bump + comment-fix on a gated job is a safe WOULD_APPROVE shape

**PR:** shader-slang/slang #12684 @ fefd2a08603d ("ci: give test-falcor room for the approval gate, and fix its comment"). Decision WOULD_APPROVE; a MEMBER human independently APPROVED at the exact head (live_late) → agreement.

**Symptom / shape:** A `.github/workflows/*.yml` change that ONLY (a) raises a job's `timeout-minutes` and (b) rewrites an explanatory comment — no change to `runs-on`, `permissions`, `environment`, `on:` triggers, secrets, or any run step.

**Why it's safe (the transferable class):**
- A larger `timeout-minutes` can only *permit* longer execution before GitHub kills the job; it cannot introduce a failure. It is a strictly-loosening operational knob. So it is the CI analogue of the "widening-only" exception — no new failure direction to positive-control.
- A comment-only change carries zero runtime effect. Verify only that it is factually accurate; here the old comment wrongly claimed "team members' PRs run automatically" — GitHub environment protection (required reviewers) has NO per-actor scoping, so every run (incl. team members' and merge-queue runs) pauses for the same approval. The new comment states this correctly.

**How to catch the not-safe variant:** diff the SAME file for any co-change to `runs-on`/`permissions`/`environment`/`on:`/secrets/run-steps — those ARE supply-chain / trigger surface and are NOT covered by this shape. If the only lines that changed are `timeout-minutes:` and comment (`#`) lines, the challenger needs nothing beyond confirming the comment's factual accuracy.

**Policy note:** under the mounted `v0-shadow-wide` policy (human sign-off haaggarwal 2026-08-04) `.github/**` is deliberately NOT protected in shadow mode (final gate is human; a Step-1 FAIL there only destroys measurement signal). The bundled `v0-shadow` default WOULD have failed `no_protected_paths` → ABSTAIN. When enforcement arrives, `.github/workflows/**` becomes a supply-chain surface again — re-tighten, and this "timeout-only" shape would then need explicit human sign-off rather than auto-approve.
