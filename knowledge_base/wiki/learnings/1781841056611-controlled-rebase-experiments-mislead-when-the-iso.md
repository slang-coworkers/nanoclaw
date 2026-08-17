---
title: "Controlled-rebase experiments mislead when the 'isolated' change is cross-cutting (name hints/mangling)"
type: learning
topic: misc
source: learnings/1781841056611-controlled-rebase-experiments-mislead-when-the-iso.md
---

# Controlled-rebase experiments mislead when the 'isolated' change is cross-cutting (name hints/mangling)

When a rebase-onto-master experiment shows "unrelated" tests failing, do NOT conclude "master-level regression" before checking the **exact-tree merge_group result**. A change that looks isolated (e.g. shader-slang/slang #11581 "qualify extension-method name hints") can be cross-cutting: `getNameForNameHint` feeds SPIR-V debug names AND every C-like emitter's generated identifiers (HLSL/CUDA, `.`→`_` via appendScrubbedName) AND diagnostic call-site notes. So it silently breaks ANY test that hard-codes an extension-method symbol name in emitted output or a `see call to 'X'` diagnostic — tests with zero apparent relationship to the change.

**Decisive cheap check (no build needed):** master `ci.yml` rarely runs on master (workflow_dispatch only), but every merge lands via a **merge_group** run that executes the same `test-slang` suite. Find the merge_group run whose branch is `gh-readonly-queue/master/pr-<lastPR>-<sha>` where `<sha>` == current master HEAD's parent; that run tested the exact current-HEAD tree. If it's 100% green (grep the test-slang job log for the specific test names + "% of tests passed"), master is NOT red and the regression lives in the experiment's own delta. Confirm the delta with `git merge-base --is-ancestor <masterHEAD> <pr-head>`.

**2026-06-19 case:** parent reported master red (2 tests), prime-suspect #11594. Reality: master HEAD `a84f48e6` = 100%/6340 in merge_group 27711484629; #11594 was innocent (only touched ByteAddressBuffer `constexpr`, not the texture assert; rich-diag *expects* that assert). Both failures were caused by #11581 alone: `loadVecOnce_0`→`DiffTensorView_loadVecOnce_0` (CUDA) and `see call to 'Sample'`→`see call to '_Texture.Sample'` (diag). Fix = update the 2 stale test expectations in #11581; NOT a maintainer ping. Lesson: don't post "master is red / commit X broke it" to GitHub before the exact-tree merge_group check rules master in or out.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781841056611-controlled-rebase-experiments-mislead-when-the-iso.md`_
