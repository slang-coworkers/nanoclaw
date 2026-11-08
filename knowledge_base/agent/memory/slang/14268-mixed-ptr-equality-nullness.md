---
type: chain
title: "slang#14268 — mixed Ptr ==/!= compares nullness via implicit Ptr→bool"
description: Human-filed (tdavidovicNV) silent wrong-code bug, triaged P2 and reproduced 11-03; PARKED on a maintainer semantics decision (sibling of #14086), no fixer handoff. Next triager one-shot t-f032cc 2026-11-14 16:00Z.
tags: [pointers, overload-resolution, silent-miscompile, parked]
resource: raw/triage-14268.md
---

# slang#14268 — mixed `Ptr` `==`/`!=` silently compares nullness

Filed 2026-11-03 by tdavidovicNV (human, no labels). The `issue_opened` webhook reached Main 22:06Z. No
earlier memory hit. Dispatched to slang-triager on `gh-issue-shader-slang/slang-14268` (R6: no waiting period).
Sibling of [[14086-14089-pointer-semantics-parked.md]]: both bugs come from the same `bool.__init(Ptr)` (core.meta.slang:1697-1702).

## Triage (22:24Z; memo in raw/triage-14268.md)

- I checked the receipt: triage comment 6616915838 was posted by nv-slang-bot at 22:22:44Z. The issue is
  open and labelled `reproduced`. The triager also says it set Type=Bug.
- Reproduced on master `f1cd35ff8`: cuda and spirv-asm both exit 0 without a diagnostic. On the L40S, vk
  and cuda both give `1 0 1 0 1 0 0 1`; the correct result is `0 1 0 1 0 1 0 1`.
- Cause: the six Ptr comparison operators (core.meta.slang:1672-1694) use one shared
  `Ptr<T,access,addrSpace,L>`, so any mismatch leaves only bool==bool. The conversion cost is 400, below the
  500 threshold for warning 30081.
- New findings: a different AddressSpace has the same bug. `<`, `<=`, `>`, `>=` give an error instead (the
  different-Access case gets a confusing "ambiguous int64"). The implicit `Ptr<T>`→`Ptr<void>` conversion
  (:2251-2254) never applies.
- Options: (1a) compare addresses within one address space (C-like); (1b, **recommended**) C++-like
  heterogeneous `==`/`!=` with `[OverloadRank(-1)]`, plus a static_assert error for unrelated T or a
  different address space; (2) a diagnostic only; (3) make Ptr→bool contextual-only. Option 3 fixes #14086
  too, but it breaks `bool b = p`. Raising the cost is rejected.

## State

**PARKED** until a maintainer chooses: either mixed-type pointer `==`/`!=` is supported and compares
addresses (1a/1b), or it is an error (2/3). A further choice is whether to decide it together with #14086.
No fixer handoff, the same policy as #14086/#14089. The triager offered to hand 1b to slang-fixer if
asked. Timer: the triager's one-shot `t-d8d291` ran 2026-11-07 16:00Z (no change); the next is `t-f032cc`,
2026-11-14 16:00Z (both reported by the triager; I cannot see them from Main). The operator was told on orchestrator-dashboard at 22:25Z 11-03 (row 15).

## 11-04 16:37Z — reporter follow-up (comment 6636216092)

- The reporter, tdavidovicNV, found the same implicit-bool fallback in two more cases, on master
  3da6f63c0:
  - Ptr vs a number. It gives warning E30081 but still compiles, and compares nullness.
  - Ptr vs a user type that converts to bool, and two unrelated user types (`marker == other`). Neither
    gives a diagnostic.
- They lean toward C++-style contextual bool. They also show that making the conversion explicit-only
  currently rejects `if (marker)`.
- They ask that the semantics decision also cover these cases. They propose no patch.
- I relayed the comment verbatim to the owning triager session `sess-1793743819364-qu7r2w`. It landed as
  inbound seq 22 at 16:41Z, so I verified it. I asked the triager to re-check on master, re-assess the
  options (1a/1b cover only Ptr/Ptr), post a fresh delta, and re-aim t-d8d291 if it no longer fits.
- The chain is still PARKED on a maintainer. No fixer.
- **16:53Z triager report.** Both new cases reproduce on 3da6f63c0:
  - Case 1 gives `1 0 1 0 0 0` on L40S vk and cuda (4× E30081; the uint64→bool cost is 900).
  - Case 2 gives no diagnostic (checked on cuda codegen).
  - The reporter's explicit-only control is confirmed: E30019 on `if (m)`, `!m`, `&&`, `||` and `?:`.
  - Delta comment 6636551602 was posted at 16:51:28Z; I verified it.
- **New recommendation:** option 3 (contextual-only Ptr→bool) plus option 2 (a diagnostic when `bool ==`/`!=`
  is reached through an implicit conversion of a non-bool operand). Option 1 is now optional.
- **Cost of option 3:** a new coercion site for conditions and a "condition-only" marker on the conversion,
  and the `canCoerce` caches must be keyed by site (slang-check-conversion.cpp:3228). It is a breaking
  change for `bool b = p`.
- One joint decision with #14086 is proposed. t-d8d291 keeps 11-07 16:00Z; its prompt now looks only at
  comments after 16:51Z. The operator got the delta on orchestrator-dashboard.

## 11-07 re-check (t-d8d291)

- The triager's report (msg 2, 16:01Z) says the issue is still parked. I verified it on GitHub: there is no
  comment after delta 6636551602, and the last update was 11-04 18:18Z.
- The events on 11-04: at 17:29Z jkwak-work assigned kaizhangNV, added the `RTR` label (it is now `RTG`) and
  set milestone Q1 2027 (Winter). At 18:18Z kaizhangNV was unassigned and jkwak-work assigned themself.
  jkwak-work is now the decision owner for both #14268 and #14086. No one has commented.
- The next one-shot is the triager's **t-f032cc, 2026-11-14 16:00Z** (#14086: t-964832, 11-13). Main did not
  reply and sent nothing to the operator: the report asks nothing and has no new facts for the operator.
