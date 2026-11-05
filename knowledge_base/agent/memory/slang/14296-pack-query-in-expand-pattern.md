---
type: chain
title: slang#14296 — value-pack queries (__trimFirst/__trimLast) fail inside an expand pattern
description: Maintainer (jkwak-work) self-filed + self-assigned 2026-11-04 04:35Z, found while working on #14292. HELD until 11-04 jkwak-work @-mentioned the bot asking to triage and make a PR -> DISPATCHED to slang-triager on gh-issue-shader-slang/slang-14296.
tags: [frontend, generics, variadic, value-pack, expand, maintainer-owned, held]
---

# slang#14296 — `expand Layer<each __trimLast(S), each __trimFirst(S)>` → E39999

**11-04 04:35Z, `issue_opened`.** Live read (11-04): OPEN, author **jkwak-work**, assigned to jkwak-work by
jkwak-work 1 s after filing (timeline `assigned` 04:35:17Z), 0 labels, 0 comments.

**Ask.** A pack query on a value pack can't be used inside `expand`: as a generic value argument it gives
E39999 (not a compile-time constant); as an expression `expand (each __trimLast(S)) + (each __trimFirst(S))`
gives E30105 ("captures no type packs"). `countof(__trimLast(S))` and `expand Layer<each S, each S>` work.
Exposed because `tests/language-feature/generics/variadic-pack-query-layer-shape.slang` (#10444) passed on a
`CHECK: 3` matching the `3` in `E39999`; [#14292](14292-slang-test-exit-code-all-test-types.md) disables it
with a TODO pointing here and at sibling [**#14297**](14297-countof-tuple-expand-generic-pack-size.md) (`countof(Tuple<expand Wrap<each T>>)` returns 1; same
author, self-assigned 04:35:26Z — its own `issue_opened` decides it).

**Dedupe (11-04):** no open duplicate. Related, closed: #12494 (`__first`/`__last` pack-query ops crash slangc).

**Disposition: held, nothing dispatched or posted.** Same jkwak-work self-filed series
([#14295](14295-ptr-extension-instance-method-lookup.md), #14292, #14266, #14248); #14247 showed a bot fixer on
such an issue gets closed as overkill.

**Resume** only on a comment that @-mentions @nv-slang-bot, or an operator ask. No timer (mentions arrive as webhooks).

## Timeline

- 11-04 `pr_mention` comment **6636165810** (jkwak-work): "@nv-slang-bot can you triage and make a PR?" — the
  resume condition. No prior triager/fixer session on the thread (only my own webhook sessions). Dispatched to
  slang-triager on `gh-issue-shader-slang/slang-14296` with `<github-post-authorized />`; triager hands off to
  slang-fixer for a draft PR. Orchestrator note sent: keep scope to #14296 (#14297 is separate, not asked), and
  #14247 precedent (maintainer closed a +334 PR as overkill) argues for a small producer-side fix.

- 11-04 16:37Z triager ack: triaging on master 3da6f63c0 (repro, root cause, dedupe vs #14297); sentinel set.
- 11-04 16:49Z **TRIAGED** bug/medium/frontend/P2, no dup, not a regression; repro on master 3da6f63c0 (memo
  `/workspace/inbox/a2a-1793810949868-74lnme/triage-14296.md`). Root cause (triager's finding, read from the code
  but not yet test-proven): `each <expr>` over a VALUE pack only handles a plain `DeclRefExpr` operand, in
  `visitEachExpr` (slang-check-expr.cpp:8216, gives E30105) and in the `EachExpr` branch of `tryConstantFoldExpr`
  (:3136-3156, gives E39999). The Val layer and lowering already support `EachIntVal(TrimLastIntValPack(S))`.
  Recommended fix (A): one shared fold helper, ~20-30 lines in one file. Rejected: (B) a `PackQueryExpr` special
  case, (C) a Val stored on `PackQueryExpr`. Can be verified without #14297 using Tuple-free forms.
  `variadic-pack-query-layer-shape.slang` must stay off with TODO(#14297); this collides with maintainer PR **#14299**
  (`slang-test-exit-code-interpret-reflection`, open, non-draft), which also turns that test off. The triager is
  asking the maintainer on the issue. Handed to slang-fixer, branch `fix/issue-14296`. Issue comment and labels
  were still pending at 16:50Z.
- 11-04 16:50Z slang-fixer `sess-1793810963009-n3vn10` claimed (worktree wt-slang-14296 at 3da6f63c0, debug build ~20 min).
  Issue post verified: nv-slang-bot cmt **6636516739** (16:49:57Z), labels `reproduced` + Type=Bug.
  One session per group on the thread (triager `sess-1793810177162-wnbll4`, fixer above); no duplicates.
- 11-04 16:51Z triager [Report] asked how to coordinate the shared test `variadic-pack-query-layer-shape.slang`
  across #14296, #14297 (sibling chain, fixer `sess-1793810920784-gpy91h`) and maintainer PR #14299. **I accepted the
  triager's proposal**: each bot PR adds its own Tuple-free test. Neither bot PR re-enables the layer-shape test
  until both fixes and #14299 are on master; whichever bot PR lands last re-enables it. If #14299 hasn't merged when
  this PR's CI runs, the test (still on master) will fail after the fix, so turning it off with TODO(#14297) in this
  PR is allowed. A maintainer answer on the issue overrides all of this.
- 11-04 16:53Z My reply reached the triager (my msg 21). The triager passed the test rule on to the fixer as a handoff update (triager seq 17). Next: the fixer's draft PR. Ready-flip goes on the weekly list (P2, not a regression).
- 11-04 18:05Z **DRAFT PR #14314** (head cbc81d5b9, `fix/issue-14296`, `pr: non-breaking`, author nv-slang-bot,
  3 files +120/−20). Verified via API. pr-mapping → slang-fixer `sess-1793810963009-n3vn10` (canonical thread).
  The fix (triager's summary): both value-pack `each` sites in `slang-check-expr.cpp` now fold their operand with
  `tryConstantFoldExpr`. New test `variadic-pack-query-value-pack-expand.slang` (INTERPRET, 10 cases, no Tuple).
  `variadic-pack-query-layer-shape.slang` is turned off with TODO(#14297). Its `DISABLE_TEST` line is the same as
  #14299's but the TODO text differs (#14299 says TODO(#14296, #14297)/E39999, which is stale after this fix), so
  expect a one-hunk conflict for whichever merges second; I left the choice to the fixer. Issue comment 6636516739
  edited 18:09Z. Next: the fixer's review cycle → [Fix Report]. Ready-flip goes on the weekly list (P2, not a regression).
- 11-04 18:13Z fixer status (its claims): new test 10/10, tests/language-feature/ 2704/2704. [Fix Review Request] sent to slang-reviewer and CI dispatched. Next: the reviewer verdict → [Fix Report].
- 11-04 19:41Z **[Triage Resolution]**: fixed in a draft PR, held. PR #14314 is now at head **17e4129ae**, +190/−20,
  still a draft (verified via API). Reviewer R1 gave APPROVE_WITH_NITS; the nits are applied. Two open points are
  out of scope and listed in the explanation comment: no same-length check across captured packs, and an operand that
  cannot fold still gives E30105. Local run (fixer's claim): 3725/3725. CI run 41898940454 is in progress; the cbc81d5
  run was held by `wait-for-human-priority`. The layer-shape test prints `3 0` with #14313 (the #14297 fix PR, draft)
  applied. Fixer status comment 6638274541. Next human action: jkwak-work reviews #14314 and decides when it leaves draft.
- 11-04 19:42Z Side find: an `expand` over value packs of different lengths gets no diagnostic (it prints a wrong
  count, and using the elements crashes with exit 139). The fixer's cause is that `ExpandIntValPack::_substituteImplOverride`
  (slang-ast-val.cpp:3108) and `maybeSpecializeExpand` take the length from capture 0 only. Related to open #12796
  (a different layer, so not a duplicate). I told the triager to choose (a): file a new issue that names #12796. Under
  the filing policy this needs no operator go. A bot-filed `issue_opened` for it belongs to this chain: **do not dispatch it**.
- 11-04 19:44Z Side find filed as **#14320** (bot, `reproduced`, Type=Bug, no fixer chain). The triager reports that type
  packs show the same silent wrong count. Triage comment 6636516739 now names it. Its `issue_opened` belongs to this
  chain: **do not dispatch it**. A maintainer decides whether it gets a fixer.
- 11-04 `issue_opened` for **#14320** arrived (live: OPEN, bot-authored 19:43:43Z, `reproduced`, unassigned, 0
  comments). Not dispatched, per the rule above. It resumes only on a maintainer comment or @-mention, or an operator ask.
