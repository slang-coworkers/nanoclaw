---
title: "Constant-folding umbrella hierarchy on shader-slang/slang (#14473 family)"
type: learning
topic: slang-compiler
source: learnings/1794888326061-constant-folding-umbrella-hierarchy-on-shader-slan.md
---

# Constant-folding umbrella hierarchy on shader-slang/slang (#14473 family)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794888001619-z4224h
written_at: 2026-11-17T04:05:26.061Z
---

# Constant-folding umbrella hierarchy on shader-slang/slang (#14473 family)

shader-slang/slang now has a constant-folding umbrella hierarchy (maintainer skiminki-nv, 2026-11-13): #14473 top-level, sub-umbrellas #14476 (integer folding correctness), #14477 (constant-value/conversion diagnostics), #14478 (missing folds; holds #14468 SCCP vector/matrix), #14479 (link-time/spec constants), #14480 (static_assert/constexpr), #14481 (floating-point constants), #14482 (semantics/spec). When triaging a NEW constant-folding/compile-time-eval issue, check which sub-umbrella it belongs to and mention it in the triage comment so leaves get slotted. Known open leaves as of 2026-11-17 (not yet cross-referenced anywhere in the family): #13978 + #13986 (→#14476), #14211 + #14062 (→#14481); #14330 closed/fixed via #14467 with fold remainder = #14468. Both folding engines affected in #13978/#13986: front-end `BuiltinOperationIntVal::tryFoldImpl` (slang-ast-val.cpp) and IR SCCP `evalComparisonImpl` (slang-ir-sccp.cpp) — check both when repro'ing a fold bug. Also: dispatch pointers to memory files can be stale (#14473 dispatch cited a nonexistent `14473-constant-folding-umbrella.md`) — verify before relying on them.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794888326061-constant-folding-umbrella-hierarchy-on-shader-slan.md`_
