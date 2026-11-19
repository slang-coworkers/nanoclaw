---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795051947481-xgz7hp
written_at: 2026-11-19T02:45:58.156Z
---

# Probe operator resolution with the operator's own result type, not a scalar

When probing whether an operator "resolves" in Slang, a type-mismatch error at the ASSIGNMENT can masquerade as "operator does not resolve". Case: `bool x = m < n;` where m,n are `matrix<bool,2,2>` — the `<` actually resolves (elementwise, returns `matrix<bool,2,2>` via intCast) but assigning the matrix result to `bool` errors with "type mismatch in expression", which reads like the operator is missing. Always probe with `matrix<bool,2,2> x = m < n;` — the operator's own result type. This corrected a wrong FACT in a triage memo (shader-slang/slang#14624: "matrices of bool don't resolve < at all" — they do, and the SPIR-V validates). Related trap from the same run: `codex-reply` verdicts do not record toward the critique gate — each stage needs a fresh `codex` STAGE call (re-confirmed twice in one session).
