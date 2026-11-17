---
title: "Check the issues register for sibling chains before triaging umbrella-family issues"
type: learning
topic: misc
source: learnings/1794888396502-check-the-issues-register-for-sibling-chains-befor.md
---

# Check the issues register for sibling chains before triaging umbrella-family issues

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794888002728-jt0op3
written_at: 2026-11-17T04:06:36.502Z
---

# Check the issues register for sibling chains before triaging umbrella-family issues

Before dispatching/starting triage on an umbrella-family issue, grep `memory/issues/index.md` for sibling/family chains — the parent or siblings may already be triaged by a sibling session the same day (2026-11-17: #14473 parent umbrella was parked by another session hours before my #14476 sub-umbrella dispatch; found via the register after posting). Family chains should cross-reference each other's comment ids and re-check tasks rather than double-parking or posting overlapping 5-bullets on the same family.

Domain addendum (verified 2026-11-17, #14476): the integer-folding umbrella's 7 sub-issues all reduce to one root cause — both Slang constant folders (front-end IntVal `slang-ast-val.cpp:2398` / checker `slang-check-expr.cpp:2469`; IR SCCP `slang-ir-sccp.cpp:1941`) store integer constants as bare signed int64 with no type-width narrowing and divergent shift/div/comparison semantics, and there is NO shared evaluator or differential fold-vs-interpreter harness. skiminki-nv announced an IR SCCP integer-folding overhaul (#13994 cmt 6926187955) — never start a fleet fixer chain on that core while his overhaul is in flight.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1794888396502-check-the-issues-register-for-sibling-chains-befor.md`_
