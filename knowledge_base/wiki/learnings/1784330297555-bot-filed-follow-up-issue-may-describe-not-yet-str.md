---
title: "Bot-filed follow-up issue may describe not-yet-stripped work as already removed (preserve before trim)"
type: learning
topic: misc
source: learnings/1784330297555-bot-filed-follow-up-issue-may-describe-not-yet-str.md
---

# Bot-filed follow-up issue may describe not-yet-stripped work as already removed (preserve before trim)

**Context:** Triaging shader-slang/slang#12150 — a maintainer-requested (pdeayton-nv) follow-up split out of draft PR #12148 (#11983 debug-info work).

**The trap:** #12150's acceptance says "the include-defined + multi-compilation-unit regression tests **removed** from PR #12148 are restored." But the issue was filed 4 min after the maintainer *agreed to* the split — the trim commit was NOT yet pushed. At the PR head, `findIncludingNonIncludedSourceFile()` (+103 lines in slang-lower-to-ir.cpp) and all 5 `tests/spirv/debug-function-scope-*` fixtures were **still present**. "Removed" was the *plan*, not the state.

**Why it matters for the fixer:** The deferred work is recoverable — from the pre-trim commit — but only if you look before the PR is trimmed. A fixer who reads "restore the removed tests" literally and starts writing them from scratch wastes effort and may diverge from the validated prototype. Correct move: PRESERVE the about-to-be-stripped code/fixtures (branch/stash/cherry-pick from the pre-trim commit), then re-add + extend.

**General rule:** When a follow-up issue (especially bot-authored, filed alongside a live PR) says work was "removed/deferred," VERIFY the PR's actual current diff with `gh pr diff` before believing it — the issue may have been filed *ahead of* the change it describes. Cross-check issue narrative against live PR state; don't trust the tense.

**Also confirmed (debug-info):** DebugCompilationUnit is emitted only for non-included files (`slang-lower-to-ir.cpp` `... && !source->isIncludedFile()`); #include/__include'd AND #line-remapped sources get an IRDebugSource but no CU → -g2 DebugFunction falls back to module-global scope. Owning CU is resolvable via the SourceView initiating-location chain (`_calcViewInitiatingHierarchy`, slang-compile-request.cpp), anchored to the CURRENT TU's source manager (a SourceFile can be shared across modules). #line source-mapping prior art: merged PR #9945. Producer-side binding required (survives linking); emit-time resolution reintroduces the heuristic PR #10907 removed.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784330297555-bot-filed-follow-up-issue-may-describe-not-yet-str.md`_
