---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787357416293-3boe10
written_at: 2026-09-01T19:29:56.343Z
---

# [approver/critique-mustfix] Don't record a "clean / would-approve" substantive claim before ALL review inputs land — even when a Step-1 clause fail short-circuits the decision

**Symptom:** On slang#12690 rev 3 (head 26086fc16706, a fork), the decision was a deterministic Step-1 `CLAUSE_FAIL:head_provenance` (fork-head forbidden under the fallback policy), so I (correctly) didn't block on the best-effort Devin subagent. I synthesized the review doc from the primary bot's ✅ Clean verdict, ran clauses, and RECORDED — writing in the decision's substantive-context that R3 was "the cleanest revision / would plausibly be WOULD_APPROVE absent the policy." Devin then returned (~95s later) flagging a potential 🔴 bug — "dependent equalities remain re-entrant" (slang-check-inheritance.cpp:1163) — which the primary bot's ✅ Clean had NOT caught. My "clean" claim was already recorded and reported up.

**Root cause:** Two review sources (production bot + Devin) can DISAGREE. When a Step-1 clause fail short-circuits the DECISION, it's fine not to block on Devin for the decision itself — but the *substantive-context* narrative ("clean / would-approve") is a positive signal a human may act on, and it must not be asserted while a review input is still pending. I let the decision's short-circuit license an over-confident substantive claim sourced from only one reviewer.

**How to catch it:** Before writing any "clean / would-approve / cleanest" substantive characterization (even as non-binding context on an ABSTAIN), confirm ALL review inputs have landed and RECONCILE them. If Devin is still running, either (a) wait for it, or (b) explicitly caveat "Devin pending" and never assert clean. Divergence (bot ✅ Clean vs Devin 🔴) is itself a high-value signal to surface, not average away.

**Fix:** For a Step-1-short-circuit ABSTAIN, keep the substantive section to what's certain and reconciled; if a reviewer is pending, say so. When a late input contradicts a recorded free-text claim, the ledger row is append-only (can't edit) — so CORRECT it in the work artifacts AND report the correction upward promptly (decision enum unchanged, but the narrative retracted). Reporting faithfully > tidy closure. Concretely here: bot ✅ Clean vs Devin "equality re-entrancy at :1163" — the reorder defers the super-type to ensureDecl for DIRECTED constraints, but for an EQUALITY constraint tryResolveConstraintTypes resolves both endpoints eagerly, so a dependent equality (sup = generic app) can still re-enter; a path the directed-only reorder may not cover. Worth a challenger dig / build next time this shape appears.
