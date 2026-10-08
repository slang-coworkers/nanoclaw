---
type: chain
title: slang PR #12136 — lazy autodiff builtins, approver re-review loop
description: Fork PR re-pushed 10x; the approver's verdicts go unrecorded, and since Sep 14 its session sits in cost escalation and drops dispatches
tags: [slang-pr-approver, cost-cap, approval-ledger, fork-pr]
---

# slang PR #12136 — "Load autodiff builtins on demand" (jvepsalainen-nv, fork)

**Fork PR:** `isCrossRepository: true`, branch `issue-12113-lazy-autodiff-builtins`. Routed to
`slang-pr-approver`, which keeps reusing one session: `sess-1784180176857-773lfi`, thread
`gh-issue-shader-slang/slang-12136`. No other sessions exist for this PR.

## Revisions (head → approver verdict)

| Rev | Head | Date | What changed | Verdict |
|---|---|---|---|---|
| R4 | `25d3e44e` | 08-10 | — | ABSTAIN_POLICY / OPEN_GAP |
| R5 | `a68db469` | 09-01 | rebase | ABSTAIN_POLICY / CLAUSE_FAIL:head_provenance |
| R6 | `895ee0d3` | 09-03 | rebase + test fix | CLAUSE_FAIL:head_provenance |
| R7 | `eeb0ee40` | 09-14 | master merge | **sent, never answered** |
| R8 | `80020d53` | 09-16 | master merge | held by me (churn) |
| R9 | `0ec118d1` | 09-17 | **real commit**: `_validateBuiltinModuleDependencies` | **sent, never answered** |
| R10 | `14a2185f` | 10-01 | master merge only | held by me; the PR's own diff is identical to R9's |
| R11 | `e91d7732` | 10-05 | master merge only; PR's own diff matches R10 on 22 of 23 files. In `include/slang.h`, `SaveAutodiffModule`/`…BinSource` moved from 162/163 to 163/164 (master took 162 for `DiagnosticFormat`), so the enum stays append-only | not forwarded: approver `paused=1` + cost-escalated |

**The finding, unchanged since R4:** the language server never learned the new `autodiff`
module name. Two places: `getBuiltinModuleSource` returns an empty blob with `SLANG_OK`, and the
goto-def allowlist is core/glsl only. At R10 these sit at `slang-language-server.cpp:3278` and
`:1224`. Line numbers shift on every rebase, so match on the code shape, not the number.

## Open blockers (all need the operator)

0. **The approver group is `paused=1`** (since ~09-10, operator decision pending from 09-29 msg 29).
   R7/R9 arrived after the pause, so they sit unread **regardless of cost**: a `cost-cap continue`
   alone won't wake it. Caught 10-04; the Oct-01 ask had missed it. #12136 is now listed in
   `approver-pause-followup-b5f2`. ⇒ When a session is silent, check `paused` before blaming cost.
1. **Cost escalation stalls the session.** `ncl cost-cap status` shows `escalated`:
   spent $51.18, cap $31.59, ceiling $83.69. Dispatches R7 (inbound seq 78) and R9 (seq 80) were
   delivered. `last_active` updated on each, but there has been **no outbound since seq 147
   (09-03)**. `cost-cap stopped` reports nothing for this session, because `escalated` is not
   `stopped`. Do not run `cost-cap continue` without the operator's say-so.
2. **`APPROVAL_LEDGER_WRITERS` is unset on the host.** Every `record_decision` is denied.
   First flagged 08-10.
3. **Reports don't reach me.** The approver's OUTPUT_REVIEW gate blocked its handoff (its seq
   64/66). Verdicts exist only as rows in its own session.
4. **Fork provenance.** The empty policy mount means every revision abstains on
   `head_provenance`. This is by design, but each run still costs money.

## How to check whether a push is substantive

A raw `compare lastHead...newHead` is inflated by master merges. It also caps at 300 files.
Instead, compare the PR's own diff: take the `+/-` lines of `compare <master-parent>...<head>`
for each implementation file and check them against the previous revision's
`compare <merge-base>...<prevHead>`. R10 vs R9 matched on all 23 files.

Re-chases: `rechase-12136-approver-c-c050` (10-04: unchanged, head still `14a2185f`, no operator
answer; re-pinged as dashboard msg 41 with the pause correction) → `rechase-12136-approver-d-b6d8`
(10-07: still paused=1, still escalated with the same figures, no outbound after seq 147, no operator answer
to msg 29/41 in the 400 most recent dashboard rows; head R11 `e91d7732`; one reminder line sent, msg id 23)
→ `rechase-12136-approver-e-f511` (10-10 09:00Z).
