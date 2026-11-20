---
type: chain
title: "slang#14473 — Constant folding umbrella (maintainer tracking issue, no chain)"
description: Umbrella issue by skiminki-nv (2026-11-16) to track AST and IR constant folding issues. No dispatch — maintainer-owned tracking issue; holds no bug itself. Reference it when constant-folding sub-issues arrive.
tags: [slang, constant-folding, umbrella, tracking, skiminki-nv, no-dispatch]
---

# slang#14473 — constant folding umbrella

Opened 2026-11-16 by **skiminki-nv** (maintainer). Title: "Constant folding umbrella".
Body: "Umbrella issue to track AST and IR constant folding issues". No labels.

**Decision: no dispatch.** It is a maintainer's tracking issue, not a bug report — nothing to
triage, reproduce, or fix. Could not check live assignees at intake (GitHub auth outage,
already on the dashboard); for a maintainer-filed umbrella this changes nothing.

**Sub-umbrella #14478** ("[Constant folding] Missing folds umbrella", same author, 2026-11-16):
"Sub-umbrella of #14473 tracking expressions that should fold to compile-time constants but
don't." Same decision: **no dispatch, no post** — same maintainer-owned tracking nature; the
assignee check stayed blocked by the same auth outage. Sub-issues of #14478 are "missing fold"
cases: triage them as their own chains, citing #14478/#14473 same-repo (fine under the
cross-link rule); a fold-gap fix that touches constant folding may reference both.

**Use:** when a constant-folding sub-issue arrives (webhook or reference), record its relation
to this umbrella in its own chain record; a triager may cite it (same-repo link, fine under
the cross-link rule). Existing constant-folding-adjacent chains at intake:

- [13424 — loops with a constant trip count not folded at -O3 (SPIR-V)](13424-loop-constant-folding.md) — held
- [14214 — SPIR-V constant resource choice across helper call not folded → E56004](14214-constant-resource-choice-fold.md) — stood down, overlaps PR #14358

**Sub-umbrellas:** [#14482 — semantics/spec](14482-constant-folding-semantics-umbrella.md) (also maintainer-filed, no dispatch).

## Sub-umbrellas

- **#14480 — "[Constant folding] static_assert and constexpr umbrella"** (skiminki-nv, 2026-11-16).
  Tracks compile-time evaluation for `static_assert` and `constexpr`. Same decision as the parent:
  maintainer tracking issue, **no dispatch**. GitHub auth still 401 at intake (same outage as
  parent's intake, same day), assignees unverifiable — immaterial for a maintainer umbrella.
  If a concrete static_assert/constexpr bug sub-issue arrives, record it under its own chain
  file and cite both this umbrella and #14480.

**Sub-umbrella #14479** "[Constant folding] Link-time and specialization constants umbrella"
(skiminki-nv, 2026-11-16). Tracks evaluation and use of link-time and specialization constants.
Same ruling as the parent and sibling sub-umbrellas: maintainer tracking issue, **no dispatch,
no post**. GitHub API still 401 at intake (same known outage, already on the dashboard);
assignees unverifiable — immaterial for a maintainer umbrella. Concrete link-time/specialization
constant bugs get their own chain files, citing #14479/#14473 same-repo.

**Sub-umbrella #14481** "[Constant folding] Floating-point constants umbrella" (skiminki-nv, opened
11-13; `issue_opened` webhook arrived 11-16). Tracks precision, NaN and signed-zero handling when
folding FP constants. Same ruling as the parent: maintainer tracking issue, **no dispatch**. #14386
(FloatToHalf NaN narrowing) was made a sub-issue of #14481 on 11-13 — the hold there is unaffected
(see [14386](14386-floattohalf-half-nan-signaling.md)). GitHub API still 401 at intake (known
fleet-wide outage, already on the dashboard).
