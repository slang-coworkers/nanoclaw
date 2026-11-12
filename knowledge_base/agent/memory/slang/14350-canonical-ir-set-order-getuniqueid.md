---
type: chain
title: "slang#14350 — canonical IR set order depends on the C++ compiler that built slangc"
description: Maintainer (jhelferty-nv) filed 11-05 15:07Z and self-assigned it 14 s later; found during her #11709 rework. Held under rung 4 until 11-11 19:16Z, when she asked the bot to triage (cmt 6805017670). TRIAGED 11-11 19:57Z (cmt 6805886505): bug/low/P2, approach A verified, no test-suite impact. Duplicate of bot-filed #13474 (assigned jvepsalainen-nv by jhelferty-nv 10-07). PARKED on her: which issue to keep and whether to take A; no fixer.
tags: [slang, ir, determinism, getUniqueID, typeflow, jhelferty-nv, maintainer-owned, parked]
resource: raw/triage-14350.md
---

# slang#14350 — canonical IR set order depends on the C++ compiler that built slangc

**Ask (as filed).** `IRBuilder::getSet` (`slang-ir.cpp`) sorts the set elements with
`getUniqueID(a) < getUniqueID(b)`. `getUniqueID` assigns IDs lazily, so the comparisons inside `std::sort`
assign the IDs, and the order then depends on the operand evaluation order and on the library's sort.
Repro: `createDispatchFunc` switch-case order for `-conformance "Add:IFill=0" -conformance "Mul:IFill=1"`.
A Clang build puts `Add` first and an MSVC build puts `Mul` first. `groupshared-param/dynamic-dispatch.slang`
(PR #11709) uses `CHECK-DAG` because of it. Her direction: assign the IDs in iteration order before the sort.
The same pattern exists in the typeflow set-merge loop (~line 1226), which she says is unaffected today.

**Timeline.**
- 11-05 15:07:51Z filed, 15:08:05Z self-assigned (events API; actor = assignee). Held, rung 4: no dispatch, no post.
- 11-11 19:16:12Z jhelferty-nv (MEMBER), [cmt 6805017670](https://github.com/shader-slang/slang/issues/14350#issuecomment-6805017670):
  "@nv-slang-bot Can you triage this?" (live body = payload). 19:17Z she set the issue type to Bug. Still self-assigned.
- 11-11 ~19:2xZ I dispatched slang-triager on `gh-issue-shader-slang/slang-14350` with `<github-post-authorized />`.
  The scope is triage only: no fixer and no PR unless she asks for one.

- 11-11 19:23Z, triager progress report: master built with GCC gives `Add` first, and a Clang build is running.
  **Duplicate: #13474** ("getSet element order depends on the host compiler"). nv-slang-bot filed it 10-07 01:35Z from the
  #12875/#12609 chain ([12609 record](12609-bulkcopy-dyn-interface-packing.md)). On 10-07 17:51Z jhelferty-nv assigned it to
  jvepsalainen-nv. It has 0 comments, and it is open. I checked these facts live and told the triager to leave the dedup
  decision to the maintainers.

- 11-11 19:30Z, triager (its findings, not verified by me): it could not build with Clang. Container clang 14.0.6 fails on master
  (`slang-internally-linked-list.h:122` missing `typename`; `views::reverse` at `slang-rich-diagnostics-render.cpp:621`
  against libstdc++ 12). It used GCC 12, as the Linux CI does and as #13474 did. GCC master: `Add` first. Reversed comparator
  operands: `Mul` first (the MSVC order). Assigning IDs in iteration order before the sort gives byte-identical output for all
  4 operand orders of the two comparators, with `Mul` first. So the fix changes the Linux order: test impact is being measured.

- 11-11 19:57:49Z triage posted, [cmt 6805886505](https://github.com/shader-slang/slang/issues/14350#issuecomment-6805886505)
  (I checked it live: nv-slang-bot, 5154 chars). It links #13474 and names its assignee, and leaves the keep/close decision to the
  maintainers; neither issue was closed or labeled by the bot. 19:19Z she added the `determinism` label; the triager suggested `reproduced`
  in the comment instead of adding it. Memo: [raw/triage-14350.md](raw/triage-14350.md).

**Triage (slang-triager's findings, master c66100b1e, GCC 12.2 + an MSVC stand-in; no Clang build possible).** bug, IR type-flow sets,
low, P2: the bug broke in-order FileCheck tests twice (#12875 and #11709). **A** (assign IDs in iteration order before the sort) gives
byte-identical output for all comparator and sort variants tried, on the 2- and 5-conformer repros. A full slang-test run on the L40S
gives 11880/11884 for master, the stand-in and A, with the same 4 failures that fail on master. **B** (sequence the comparator calls) is
ruled out, because stable_sort alone moves Add/Mul. Corrections posted: typeflow-specialize.cpp:1226 is not always safe (a singleton
set never calls the comparator, so its element has no ID), the IDs are also the dispatch tag constants (emitted integers vary, not only
case order), and after A the order is HashSet insertion order (reverse declaration order). **C** assigns IDs in module order if she
wants declaration order. Triager worktree `/workspace/agent/wt-14350` (5.2G, never pushed).

**Next.** PARKED on jhelferty-nv: which issue to keep (#13474 or #14350), and whether to take A or C. A fixer needs her ask or an operator
ask; give the fixer the memo. No timer, because the issue is maintainer-owned (#14333 precedent) and webhooks deliver her reply. This record is
the reference if a #13474 webhook arrives.
