---
type: chain
title: "slang#14268 — mixed Ptr ==/!= compares nullness via implicit Ptr→bool"
description: Human-filed (tdavidovicNV) silent wrong-code bug, triaged P2 and reproduced 11-03; PARKED on a maintainer semantics decision (sibling of #14086), no fixer handoff. Triager one-shot t-d8d291 2026-11-07 16:00Z.
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
asked. Timer: the triager's one-shot `t-d8d291` at 2026-11-07 16:00Z (reported by the triager; I cannot see
it from Main). The operator was told on orchestrator-dashboard at 22:25Z 11-03 (row 15).
