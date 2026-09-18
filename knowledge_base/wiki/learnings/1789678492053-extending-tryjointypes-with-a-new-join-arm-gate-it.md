---
title: "Extending TryJoinTypes with a new join arm: gate it OFF for the constraint solver"
type: learning
topic: agent-ops
source: learnings/1789678492053-extending-tryjointypes-with-a-new-join-arm-gate-it.md
---

# Extending TryJoinTypes with a new join arm: gate it OFF for the constraint solver

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789676201307-sjicds
written_at: 2026-09-17T20:54:52.053Z
---

# Extending TryJoinTypes with a new join arm: gate it OFF for the constraint solver

**Context:** shader-slang/slang#13160 (fix #13158) adds an enum⊕scalar arm to `SemanticsVisitor::TryJoinTypes` (slang-check-constraint.cpp) that decays an enum to its tag type so `cond ? Enum::Case : 0` / `select(...)` infer a scalar common type instead of falling to the deprecated `vector<T,1>` overload (which produced opaque E30019 + spurious E30056).

**Key reusable pattern (confirmed sound by review):** `TryJoinTypes` is shared between (a) ordinary-argument common-type inference and (b) the witness/subtype/equality constraint solver. A new "decay X to Y to nominate a common type" arm MUST be gated behind a defaulted flag (`allowEnumScalarJoin`) that is enabled ONLY at the ordinary-arg merge (`mergeTypeConstraint`, ~:2019) and left OFF for the solver (~:1772). If it fires in the solver path it fabricates a bogus type-param constraint (e.g. `T == int` for an enum arg) and breaks `where optional T == int`. The join should only *nominate* the type; keep `_coerce` (slang-check-conversion.cpp:2201-2220, `if (tagType == toType)`) the sole arbiter of arm legality — so an inapplicable arm still yields a clean per-arm error, not a vector fallback. This is the correct response to the prior lesson (#12753: "fixing the join" is often wrong because TryJoinTypes is solver-shared).

**Residual review gaps worth checking on any such change:**
1. Enabling the flag at `mergeTypeConstraint` broadens the behavior to ALL generic ordinary-arg calls (`f<T>(T,T)` with `(enum, scalar)` now infers `T=tagType`), not just the motivating `?:`/`select` — a latent overload-selection-shift risk. Add a user-defined generic-overload regression test, not only the `?:`/`select` ones.
2. The exclusion comment for the un-handled sibling case must be accurate: two SAME-tag enums DO share a natural common scalar (their tag), so "no natural scalar exists" is wrong — that case still repros and should be tested (pin current behavior or fix it).
3. The enum arm recurses re-passing the flag; it's inert (tag type is always a `BasicExpressionType`, never an enum → arm can't re-fire, so recursion depth ≤2). State that termination invariant in-code, and note the sibling vector-element/type-pack recursions intentionally drop the flag.

**Meta:** Reviewer A (correctness) and Reviewer C (clarity) independently converged on gaps 2+3 — expect that convergence as a positive signal. Reviewer B (Devin) timed out (30m, no stable done state) on this draft PR — Devin best-effort-skip is normal for drafts; re-run later.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1789678492053-extending-tryjointypes-with-a-new-join-arm-gate-it.md`_
