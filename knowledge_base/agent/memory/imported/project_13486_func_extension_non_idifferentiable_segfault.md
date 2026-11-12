---
type: project
name: project_13486_func_extension_non_idifferentiable_segfault
description: "slang#13486 (bot-filed 10-07 16:34Z by slang-triager while prototyping #13449, on Main order msg 85): slangc segfaults (rc 139) after E33070 when a __func_extension targets a generic whose constraint lacks IDifferentiable. Owned by the #13449 chain; no fixer; watched by the rechase-12249-13411-* one-shot chain."
metadata:
  node_type: memory
  type: project
---

# slang#13486: `__func_extension` on a non-IDifferentiable generic segfaults slangc

**Origin.** Side finding of the #13449 `__func_extension` prototype for saipraveenb25. The triager reported it as unfiled
(msg 82). I ordered it filed after deduping against #11356 and #11004 (msg 85), and slang-triager filed it from its
`gh-issue-shader-slang/slang-13449` session (msg 92). Verified: nv-slang-bot author, no labels, no @-mentions, 0 comments.

**Content.** Reproduced on master `9f31ffcfd`, rc 139 on spirv/hlsl/cpp, with a 6-line repro. The trigger is a target generic
constrained `T : IComparable` or by a user interface, i.e. not IDifferentiable. slangc reports E33070/E30855/E30850, then crashes in
`Val::resolve` ← `GenericAppDeclRef::_resolveImplOverride` ← `visitInheritanceDecl` ← `visitExtensionDecl` ←
`visitFuncExtensionDecl`. The triager's hypothesis: the extension is still built after target resolution fails. It crashes from
v2026.9.2 onward, and the feature came in with #10827. In user code it is experimental (W30131).

**Disposition: owned, nothing dispatched.** The `issue_opened` webhook minted a sibling Main session `sess-1791390898629-z7o7v3`,
so this record is the owner marker for it. The only fix request is a maintainer's. A bot-addressed human comment routes to
slang-triager on `gh-issue-shader-slang/slang-13486` with `<github-post-authorized />`. Parent: [[project_13449_generic_ifloat_minmax_not_differentiable]].

**Status as of 10-15 09:00Z: open, held.** jhelferty-nv assigned saipraveenb25 at 10-07 17:57Z. jkwak-work added the label Office-Sai at
10-13 17:12Z. Both were held, with no routing. jkwak-work asked about docs at 10-14 16:32Z (issuecomment-6173218119), and the triager
answered as nv-slang-bot at 16:42Z (6173405645). Its finding: no user-guide page exists, and SP #039 is stale. That leaves 2 comments,
no linked PR, and no fix request. The fix belongs to the assignee. A maintainer docs request or fix go-ahead routes to slang-triager
on `gh-issue-shader-slang/slang-13486`.

**Status as of 10-18 09:00Z: fix PR in review, held.** saipraveenb25 opened [#13677](https://github.com/shader-slang/slang/pull/13677)
on 10-15 19:20Z ("Stop function-extension synthesis after target resolution fails", branch `codex/fix-func-extension-error-recovery`,
closes #13486). It adds an `IsErrorExpr` check in `visitFuncExtensionDecl` (`slang-check-decl.cpp`) and 5 tests. CI: 60 pass / 1 skip.
Review requested from dshreiner-nv; only coderabbit has reviewed. The PR belongs to the assignee, and the bot neither reviews nor routes it.
#13486 counts as resolved when #13677 merges. Next one-shot: `rechase-12249-13411-c334` (10-21 09:00Z).

**Status as of 11-05 09:00Z: #13486 and #13677 unchanged since 10-15** (head ace0a99616; the 11-04 license/cla re-stamp is a repo-wide refresh,
not news). **Sibling watch #13411 is half addressed:** PR #14241 (jvepsalainen-nv, design-doc refresh, opened 11-03; APPROVED by
skiminki-nv 11-04; open) rewrites `docs/generated/design/ir-reference/misc.md` so its IsVector text is correct. It leaves the vacuous
`docs/generated/tests/design/ir-reference/misc/is-vector-folds-false.slang` untouched and does not close #13411. Both are held, with no
bot post. This was reported to the dashboard (msg 9). Next one-shot: `rechase-12249-13411-8dd3` (11-08 09:00Z).

**Status as of 11-08 09:00Z: #13486 and #13677 still unchanged since 10-15.** On #13411, **PR #14241 MERGED 11-06 11:46Z (fef74e3c67)**.
The misc.md half is now fixed on master: lines 250/266 read "True for a builtin vector type; false for a scalar or a matrix". The test
`is-vector-folds-false.slang` is unchanged (dee8b6a6f2, 09-15). I paged all 174 files of #14241 to confirm it does not touch the test, and
#13411 stays open (assignee's call, no bot post). This was reported to the dashboard (11-08). Next one-shot: `rechase-12249-13411-7f82`
(11-11 09:00Z).

**Status as of 11-11 09:00Z: #13411 is RESOLVED on master.** PR #14436 ("Refresh agentic tests against current compiler and docs",
jvepsalainen-nv, 3199 files) MERGED 11-10 13:40Z as 4f66408b3d. It removed `is-vector-folds-false.slang` and added
`is-vector-builtin-vector.slang`, which checks float→0, float2→1, int4→1, float2x2→0 on CPU. #14436 does not reference #13411, so the
issue stays OPEN. Closing it is the assignee's call, and the bot does not post. `pulls/<n>/files` caps at 3000 entries. The hit fell
inside that cap, and the misc.md commit history confirmed there were no other edits. #13486 and #13677 have not changed since 10-15.
#13449 only lost its `Office-Sai` label (jkwak-work, 11-09), which is not news. This was reported to the dashboard (11-11). The chain now
watches #13486 only. Next one-shot: `rechase-12249-13486-f63f` (11-14 09:00Z).
