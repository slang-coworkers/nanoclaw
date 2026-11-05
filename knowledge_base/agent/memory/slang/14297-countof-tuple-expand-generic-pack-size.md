---
type: chain
title: slang#14297 — countof(Tuple<expand Wrap<each T>>) returns 1 instead of the pack size
description: Maintainer (jkwak-work) self-filed + self-assigned 2026-11-04 04:35Z, found while working on #14292. 11-04 16:34Z jkwak-work asked @nv-slang-bot to triage and make a PR -> RESUMED: slang-triager dispatched on gh-issue-shader-slang/slang-14297 (post-authorized), fixer handoff via the triager.
tags: [frontend, variadic-generics, countof, tuple, maintainer-owned, dispatched]
---

# slang#14297 — `countof(Tuple<expand Wrap<each T>>)` → 1, not the pack size

**11-04 04:35Z, `issue_opened`.** Live read (11-04): OPEN, author **jkwak-work**, assigned to jkwak-work by
jkwak-work 1 s after filing (timeline `assigned` 04:35:27Z), 0 labels, 0 comments. Cross-referenced from #14296.

**Ask.** `countof` of a `Tuple` whose element is an `expand` over a generic type (`Wrap<each T>`, or value
packs `Layer<each S, each S>`) returns 1 for any pack size; `countof(Tuple<int,float,half>)`,
`countof(Tuple<expand each T>)` and `countof(T)` are correct. Tested on `slangi` at the head of PR #14269 only.
Blocks `tests/language-feature/generics/variadic-pack-query-layer-shape.slang` (#10444), which is disabled for
sibling **#14296** (same author, self-assigned 04:35:16Z: `__trimFirst`/`__trimLast` on value packs inside an
`expand`, compile errors). That test passed only because its `CHECK: 3` matched the `3` in `E39999`;
[#14292](14292-slang-test-exit-code-all-test-types.md)'s INTERPRET exit-code check exposed it.

**Dedupe (11-04):** no open duplicate (searches "countof expand", "countof Tuple pack"); only #14296 is related.

**Disposition: held, nothing dispatched or posted.** Same jkwak-work self-filed series as
[#14295](14295-ptr-extension-instance-method-lookup.md), #14266, #14292. Sibling #14296 is recorded separately ([record](14296-pack-query-in-expand-pattern.md)).

**Resume** only on a comment that @-mentions @nv-slang-bot, or an operator ask. No timer (mentions arrive as webhooks).

**11-04 16:34Z — RESUMED.** jkwak-work commented "@nv-slang-bot can you triage and make a PR?"
([comment](https://github.com/shader-slang/slang/issues/14297#issuecomment-6636157436)). Dispatched slang-triager on
`gh-issue-shader-slang/slang-14297` with `<github-post-authorized />`; the triager hands off to slang-fixer for the PR
(same shape as the #14295 resume one minute earlier). #14296 got the same ask and its own triager dispatch from a sibling session ([record](14296-pack-query-in-expand-pattern.md)).

**11-04 16:48Z — TRIAGED** (slang-triager `sess-1793810226960-cpq4uf`; GitHub cmt 6636497682 at 16:49Z; brief at
`/workspace/inbox/a2a-1793810909472-dx8uot/triage-14297.md`). Repro on master 3da6f63c0, `1 1 1`; all targets (HLSL/C++
emit `return int(1)`). Not a regression (since countof #4856, 2024-08). P2, silent wrong value. Triager's root cause:
`maybeSpecializeCountOf` (slang-ir-specialize.cpp:1162-1166) has no `kIROp_Expand` case in its "unresolved element, skip
the fold" list. After `lowerExpandType`, the result folds to 1 before `maybeSpecializeExpand` runs. Recommended fix A: add the case.
Option B (shared helper, also for `getPackBranchCardinality`) is noted. No code overlap with #14296 (front end). The
test is left to #14299. Fixer `sess-1793810920784-gpy91h` (slang-fixer) is live on the canonical thread at 16:48Z.
Side find: `__packBranch(Tuple<expand Wrap<each T>>, A, B)` as a struct field gives E99997 (assert slang-ir.cpp:1619);
told the triager to dedupe and file it, no ask needed (filing policy). A bot-filed issue_opened from it belongs to this chain.
**Next:** draft PR from the fixer. Ready-flip goes on the weekly list (P2, not a regression).

**11-04 16:52Z — shared-test coordination (decided on the #14296 chain, see [record](14296-pack-query-in-expand-pattern.md)).**
`variadic-pack-query-layer-shape.slang` needs both fixes. Each bot PR keeps its own Tuple-free test, and whichever
bot PR lands last re-enables the layer-shape test. This holds only after #14299 is on master. jkwak-work's answer on
#14296 overrides it. If the #14297 fixer touches that test, relay this rule to it.

**11-04 16:53Z — side find filed as #14309** (by the triager; Type=Bug, `reproduced`). `struct F<each T> { Tuple<expand Wrap<each T>> x; }`
followed by default construction asserts at slang-ir.cpp:1619 (parentNonBlock). Reproduced on Debug 3da6f63c0 with slangi and with
slangc for spirv/hlsl/metal/wgsl/cpp. Unrelated to the countOf fold. Nearest prior issue: #8544 (same assert, no packs). The triage comment
6636497682 now names #14309. **#14309's `issue_opened` belongs to this chain, so do not dispatch it.** FILED-ONLY; a fixer is an
operator decision, default none.
**11-04 — #14309 `issue_opened` webhook received** (author nv-slang-bot[bot], 0 labels at delivery). Matched this record on the
first grep; not dispatched, no post, per the FILED-ONLY disposition above. Resume #14309 only on a human comment/@-mention or an operator ask.

**11-04 18:14Z — DRAFT PR #14313** (`fix/issue-14297`, head 1f18a4539, draft). Adds `case kIROp_Expand:` to the
`maybeSpecializeCountOf` wait list. Fixer reports: new test 4/4 pass (slangi/cpu/vk/cuda), 0/4 without the fix. Full suite 11514/11517;
the 3 fp8-cuda failures also fail on master on this host. Issue status cmt 6638228620. slang-reviewer is peer-reviewing; the triager sends the
[Triage Resolution] after the [Fix Report]. Ready-flip goes on the weekly list.
Second side find (from the fixer, reproduced by the triager): `countof(__shapeReduce(D, 0))` with `r<2,3,4>()` gives an slangi segfault (139).
Told the triager to file it without asking. I also corrected my 16:48Z over-constraint: same-repo `#N` refs are fine. Only other-repo links are restricted
([feedback](../feedback_no_gratuitous_cross_repo_links.md)). Its issue_opened belongs to this chain.

**11-04 18:17Z — second side find filed as #14316** (triager). **Its `issue_opened` belongs to this chain, so do not dispatch it.** FILED-ONLY; a fixer is an operator decision, default none.
**11-04 — #14316 `issue_opened` webhook received** (author nv-slang-bot[bot], label `reproduced`). Matched this record on the
first grep; not dispatched, no post, per the FILED-ONLY disposition above. Resume #14316 only on a human comment/@-mention or an operator ask.

**11-04 19:12Z — [Fix Report] (fixer → me; the triager did not get it, so I relayed it).** #14313 head 223ffa9f5, still draft, `pr: non-breaking`.
Commits 702d078b8 (test) → 1f18a4539 (fix) → 223ffa9f5 (comment nits). Reviewer R1 APPROVE_WITH_NITS (0 bugs); nits applied. Explanation
comment 6638223183. Fixer reports repro 4/4 at head, full suite 11514/11517 (fp8-cuda only). CI at 19:1xZ: 4 pass, 53 skipping (draft).
Ready-flip goes on the weekly list. Reviewer side finds, sent to the triager to reproduce, dedupe and file: **S1** `countof(__trimFirst(Tuple<expand each T, int>))`
gives `1 1`, not `0 2` (`ASTBuilder::getTrimFirstPack`/`getTrimLastPack` drop an `ExpandType` operand 0). **S2** `__packBranch` picks the
non-empty branch for an empty pack (`getPackCardinalityFromStructure`, slang-syntax.h:161). S3 = #14316, already filed. Any issue_opened from S1/S2
belongs to this chain.

**11-04 19:14Z — [Triage Resolution] received.** Fixed in draft #14313 (223ffa9f5). The next human action is jkwak-work's ready-flip (weekly list).
The chain is PARKED. Still owed by the triager: S1/S2 issue numbers and the triage-comment edit. Resume on a PR review/CI webhook or a human comment.

**11-04 19:16Z — S1+S2 filed together as #14318** (triager). Shared root cause: the `ConcreteTypePack` helpers (`getTrimFirstPack`/`getTrimLastPack`,
`getFirstElement`/`getLastElement`, `getPackCardinalityFromStructure`) skip `isAbstractTypePack`, so they count an `expand`/`each T` element as one type.
The triage comment 6636497682 now names #14313 and #14318. **#14318's `issue_opened` belongs to this chain, so do not dispatch it.** FILED-ONLY; a fixer is an operator decision.
Side finds from this chain: #14309, #14316, #14318.

**11-04 19:15Z — S1+S2 filed together as #14318** (by the triager; author nv-slang-bot[bot], label `reproduced`, 0 comments, unassigned).
One issue covers both: `__trimFirst`/`__trimLast`/`__first`/`__last` and `__packBranch` on a `ConcreteTypePack` that mixes an unexpanded pack
element with other elements (`getTrimFirstPack`/`getFirstElement` in slang-ast-builder.cpp, `getPackCardinalityFromStructure` in slang-syntax.h).
No file overlap with #14314 (that PR touches slang-check-expr.cpp only). **#14318 `issue_opened` webhook received**; matched this record on the first
grep; not dispatched, no post. FILED-ONLY; a fixer is an operator decision, default none. Resume only on a human comment/@-mention or an operator ask.
