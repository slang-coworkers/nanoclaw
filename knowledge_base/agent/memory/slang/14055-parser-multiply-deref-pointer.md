---
type: chain
title: slang#14055 — parser takes `a * *p` (multiply by a dereferenced pointer) as a pointer type
description: Human-filed (albertrodriguezclo, cloth-sim batch) 2026-10-29. Regression from #6627 (v2025.6.3), frontend/parser, P1, assignee jkwak-work. Draft PR #14203 (R2 APPROVE_WITH_NITS) is PARKED on the ready flip or the assignee. Side finds live in their own records.
tags: [parser, pointers, regression]
---

# slang#14055 — `3 * *p` parse failure

Dated history (10-29 → 11-03): [[slang/14055-history-triage-to-pr.md]]. New dated entries go there; this file holds current state only.

**Ask.** `int r0 = 3 * *p;`, `a * *p`, and `*q += 3 * *p;` fail on every target with E20001 ("unexpected identifier, expected ';'")
+ E30060 ("expected a type, got 'int'"): the parser reads `3 * *` as the start of a pointer type. `3 * (*p)` works.

**Side finds of this chain** (their `issue_opened` webhooks need no dispatch):
[[slang/14078-pointer-emit-pr-stack.md]] (#14078/#14082/#14084/#14087, each with a PR),
[[slang/14086-14089-pointer-semantics-parked.md]] (#14086/#14089, parked on maintainers) and
[[slang/14205-14208-pointer-side-finds-filed-only.md]] (#14205–#14208, filed-only). Dedupes that needed no issue: HLSL E99999 → #13632;
SPIR-V `__getAddress` OpStore → #13418 (one comment with 3 more shapes); WGSL hang → #12498 (comment 6512223455, points at PR #13151).

**Cause (the triager's finding, 10-29).** Regression: v2025.6.2 compiles all three forms (OpIMul), v2025.6.3 fails; the only parser commit
between is 4eb7a27ac (#6627, 2025-03-19). The `OpMul` case at `slang-parser.cpp:9637` in the type-follower lookahead of `parsePostfixExpr`
(9622-9645) turns `x * *` into `Ptr<Ptr<x>>`. It exists because generic args go through the expression grammar
(`_parseGenericArg` → `ParseArgExpr`), so `RWStructuredBuffer<int**>`, `bit_cast<int**>` and `sizeof(int**)` need it. No duplicate;
the sibling is #6684 / PR #6686. Memo: `/workspace/inbox/a2a-1793311742182-wch6ym/triage-14055.md`.

**Fix (as shipped in #14203).** Fix A: skip the run of `*`, then apply the existing follow set; only rejected programs change
(`pr: non-breaking`). `EndOfFile` stays a type follower (`findTypeByName("int**")` goes through `parseTermString`; unit test added).
With 2+ `*` before `(`, the parser asks `_mayNameType` about the left operand, so `a * *(p + 1)`, `h.k * *(p + 1)` and `p->k` multiply
while `int**(p)` and `ns.T**(p)` stay casts. Test `tests/language-feature/pointer/multiply-by-deref.slang` (cpu/vk/cuda) fails on master.
Rejected: B (literal-only; misses `a * *p`), C (semantic; heavier), D (delete the `OpMul` case; breaks `int**` generic args).

## State (11-03 02:42Z; unchanged since)

| item | state |
|---|---|
| GitHub | OPEN, `reproduced` + `regression`, Type=Bug; assignee jkwak-work (a shepherd assignment by jhelferty-nv 11-02, offered the PR). Triage comment 6589471730 (refreshed in place) |
| PR | **#14203** DRAFT, `fix/issue-14055` @ 5872fb173, `Fixes #14055`, `pr: non-breaking`; fixer session `dxst43` (pr-mapping owner) |
| Review | R1 REQUEST_CHANGES (small) → **R2 APPROVE_WITH_NITS** (remedy and N6–N13 applied). Full suite 11414/11417 (3 known fp8-cuda; the fixer's figures) |
| Gate | **PARKED, human-gated:** the ready flip of #14203, or jkwak-work taking it over or closing it. Stop at once on an explicit stand-down request |
| Triager | owner session `1k60r3` (pin with `in_reply_to=2`) |

Other human gates on this chain's side finds: the flips of #14080 and #14085, #14088 after #14080 merges, maintainer decisions on
#14086/#14089 (re-checks 11-06), and any fixer on #14205–#14208 (operator go).

## Binding decisions

- **An assignment is not a stand-down** (11-02 override; the stale R6 rule had made it one). A stand-down needs an explicit human request.
- Reproduced, deduped side finds are filed without asking ([[../orchestrator/filing-verified-issues-policy.md]]); the 10-30 fan-out
  hold is withdrawn.

## Lessons

- `ncl sessions messages` on a RUNNING session shows only `out` rows. Infer delivery from `last_active`
  moving with no new session minted, then confirm by the peer's ack.
- Fixer reports on this chain drift to Main (01:54Z, 04:09Z, 04:53Z, 05:50Z, 06:01Z): forward each to the
  triager rather than acting on it.

