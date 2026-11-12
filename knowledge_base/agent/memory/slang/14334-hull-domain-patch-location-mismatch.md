---
type: chain
description: "Human-filed (pdeayton-nv, self-assigned) 11-05: SPIR-V regression in v2026.21 from #13078 — separately compiled hull/domain give patch field COLOR Location 1 vs 0. P1. PR #14335 is READY @87af7e3bc but BLOCKED: tangent-vector wants the front-end layout to be the only source of truth and (option C, 11-06) a prerequisite PR for global-varying layout, tracked as #14375. Stage 1 of #14375 is draft #14395 (11-10: R3 applied @94bbcc178, 'ready for a human reviewer' posted). Side finds #14366/#14375/#14376/#14397/#14434 are this chain's bot filings (issue_opened needs no dispatch)."
resource: raw/triage-14334.md
tags: [spirv, tessellation, hull, domain, varying-location, regression]
---

# shader-slang/slang#14334 — hull/domain patch locations disagree (v2026.21)

Dated history (triage, #14335 rounds, side finds, redesign, option C): [[slang/14334-hull-domain-patch-location-history.md]].
New dated entries go to the history file, not here. Triage memo: [raw/triage-14334.md](raw/triage-14334.md).

**Mechanism (triage, 11-05).** `createVarLayoutForLegalizedGlobalParam` (slang-ir-glsl-legalize.cpp:1049) put every leaf,
system values included, into `usedBindingIndex`, so `gl_Position` took slot 0 and the #13078 patch base `getLSBZero()`
returned 1, while the domain side used front-end Locations and got 0. DXC gives Loc 0 on both sides.

## Current state (11-10 05:09Z)

| item | state |
|---|---|
| #14334 | OPEN, P1 regression (`regression`+`reproduced`), pdeayton-nv self-assigned and shepherd. Reporter files and self-assigns routinely (see [#14099](slang-14099-hlsl-sibling-for-loop-redecl.md)). |
| PR #14335 | Non-draft since 11-06 17:32Z (pdeayton-nv), remote head **87af7e3bc**, `Fixes #14334`. **Blocked** by tangent-vector's option C ([6695608888](https://github.com/shader-slang/slang/pull/14335#issuecomment-6695608888)) until the #14375 prerequisite lands. Fixer `sess-1793858928003-n4rvnv`, reached via triager `j75jq7`; Main side is sibling session `o06xef`. |
| local work | 4 unpushed commits: the front end lays out the patch-constant result (`EntryPointLayout::patchConstantResultLayout`); `createPatchConstantFuncResultTypeLayout` and `getVaryingOutputLocationEnd` deleted; `translateGlobalVaryingVar` reverted to master. Per tangent-vector it becomes an `IRAttr` (`IRHullEntryPointPatchConstantOutputLayoutAttr`), not an optional operand. No push until #14375 lands. |
| #14375 | Prerequisite, self-assigned by tangent-vector; stage 1 is draft **#14395** @94bbcc178 (R3 applied, "ready for a human reviewer" posted 6759534205; waiting on tangent-vector's E30629 keep/drop call, then a human review; ready flip is the maintainers'). Record [[slang/14375-global-varying-entrypoint-ownership.md]]; dated stage-1 history [[slang/14375-global-varying-entrypoint-ownership-history.md]]. Re-check `recheck-14375-maint-qs-43b4` fired 11-11 17:00Z: case (a), record only; no timer now, webhook-only. |
| #14366 | Decided 11-06 22:39Z: struct-relative stays; resolved when #14335 lands. See [#14366](14366-patch-field-explicit-vk-location.md). |
| #14376 | FILED-ONLY, parked `advisory:maintainer-decision` (CP-first vs DXC semantic-sorted counter). |
| #14397, #14434 | Bot-filed side finds of #14395 reviews R1 (GLSL layout qualifiers) and R3 (CUDA/C++ segfault on module-scope varyings); filed only, issue_opened needs no dispatch. |
| approver | `ready_for_review` queued in `data/approver-pause-queue.md` at 87af7e3bc5 (approver paused). |
| timers | `recheck-14335-ready-6dd2` and `recheck-14335-ab-choice-9bd7` both cancelled 11-06 (un-draft done; A/B superseded by option C). |

## Decisions and lessons

- **P1 regression ⇒ the un-draft ask goes to the operator at once**, the exception to the weekly ready-flip list. It was
  resolved when the shepherd un-drafted #14335 on 11-06.
- **The maintainer's design rule:** no IR pass numbers outputs or computes offsets; the front-end layout/binding step encodes
  the patch-constant layout and legalize only reads it (tangent-vector, 11-06, 3 inline reviews on slang-ir-glsl-legalize.cpp).
  The same direction probably covers the patch-constant half of [#13427](../imported/project_13427_double_vector_varying_location_count.md).
- **Sequencing (11-06 20:23Z):** #14335 first and owns the hull's use of the front-end layout; #14366 stacks on it with only
  the shared explicit-Location rule. Then option C put #14375 ahead of both.
- **Side finds from this chain are filed without asking** ([filing policy](../orchestrator/filing-verified-issues-policy.md));
  their issue_opened webhooks need no dispatch, and a fixer chain on one needs an operator go — except when a maintainer asks
  for it, as with #14375.
- Relays to the chain's triager go pinned with `in_reply_to=2` (my webhook row), so they don't route back to the sender.

#14395 (stage 1 of #14375) readings from 11-07 on live in [[slang/14375-global-varying-entrypoint-ownership-history.md]].
