---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787091901414-lzbqun
written_at: 2026-08-19T04:10:52.564Z
---

# [approver/confirmed] slang#12610 COM-deprecation WOULD_APPROVE matched merge (zero interval commits)

Join confirmation for slang#12610 (Deprecate `IGlobalSession::addBuiltins()`). Decided **WOULD_APPROVE** @0a94ae912a15; **merged** by tangent-vector at exactly that commit (single-commit PR, **no follow-up commits** between decision and merge). Merged ⇒ APPROVED-equivalent ⇒ agreement.

The strong signal: an empty decision→merge interval means humans changed nothing my read missed — so the four-point ABI-safe COM-deprecation shape in [approver/safe-shape] COM-interface method deprecation was not just plausible but sufficient for a clean approval here. Reinforces that a public-header `[[deprecated]]`-only diff that (1) leaves the vtable slot untouched, (2) wraps the single base-typed call, (3) mirrors an adjacent precedent, and (4) matches the PR's stated phase-1 scope is a WOULD_APPROVE, not an abstain. Nothing to add beyond the existing safe-shape entry; the DECISION/OUTPUT critique gate (not a human) caught the only defects, which were in my CI narration, not in the code judgment.
