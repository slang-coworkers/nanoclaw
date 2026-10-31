---
type: chain
title: "#14055 side finds parked on a maintainer — #14086 narrow-int ptr cast, #14089 void* stride"
description: Two bot-filed P2 pointer-semantics bugs from the #14055 chain, each PARKED on a maintainer design choice with a triager one-shot on 11-06; no fixer handoff until a maintainer picks. Their issue_opened webhooks need no dispatch.
tags: [pointers, semantics, side-find, parked]
---

# #14055 side finds parked on a maintainer decision

Spawned by [[14055-parser-multiply-deref-pointer.md]]; the PR-bearing siblings are in
[[14078-pointer-emit-pr-stack.md]]. Both issues are bot-filed by slang-triager (Type=Bug, `reproduced`,
P2, unassigned), and I verified that neither body nor triage comment references #14055. **Their
`issue_opened` webhooks reached Main 10-30 and need no dispatch.** Main's direction for both: file with the
options presented, park on a maintainer, **no fixer handoff** until one agrees.

| issue | parked on | re-check |
|---|---|---|
| #14086 explicit narrow-int cast of a pointer gives `ptr != nullptr` (0/1), no diagnostic | maintainer picks the diagnostic shape | triager one-shot `t-fb3521` 2026-11-06 16:00Z (re-arms once) |
| #14089 `void*` arithmetic steps 4 bytes on SPIR-V vs error/1 byte elsewhere | maintainer picks (1) 1-byte stride everywhere or (2) a front-end diagnostic | triager one-shot `t-e18700` 2026-11-06 16:30Z |

## #14086 (a #14080 side find)

Filed 03:54Z (triage comment 6514548145, 03:53:47Z). Measured by the triager on master 1f0b33b86:
`(int)/(uint)/(int16_t)/(uint8_t)q` for `int* q` lowers to `cmpNE(q, nullptr)` → intCast, with no diagnostic
on any target; `(u)int64_t` gives the address bits. Mechanism: `int.__init(bool)` plus the implicit
Ptr→bool conversion (`extension bool … __init(Ptr)`, core.meta.slang:1697-1702, from #2342); no
`CastPtrToInt` init exists for narrow ints. gcc C warns and truncates; g++/CUDA error. No dup (nearest
#12931). Suggested direction, not a requirement: warn when an explicit narrow-int cast resolves through
Ptr→bool.

## #14089 (a #14088 side find)

Filed 04:58Z (triage comment 6515342796, 04:57:47Z). Measured: direct SPIR-V gives `vp+1` = 4
(`getSpvPointerValueType` turns `void*` into `uint*`, #11110); NVRTC CUDA and LLVM CPU give compile errors;
offline nvcc gives 1 (GNU extension). This corrects the fixer's "1 byte on CUDA". #14088's R2 dropped its
stride sentence, so #14088 does not close this.

## Lesson

Re-grep before acting on a grep miss: my first `grep 14086` ran before a sibling Main session wrote the
#14086 line, so it found nothing.
