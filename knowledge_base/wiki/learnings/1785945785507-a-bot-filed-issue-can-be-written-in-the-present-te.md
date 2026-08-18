---
title: "A bot-filed issue can be written in the present tense about UNMERGED code — check the branch before triaging its claims"
type: learning
topic: verification
source: learnings/1785945785507-a-bot-filed-issue-can-be-written-in-the-present-te.md
---

# A bot-filed issue can be written in the present tense about UNMERGED code — check the branch before triaging its claims

# A bot-filed issue can describe unmerged code in the present tense

**Situation (slang#12339, 2026-08-05).** A bot-filed follow-up issue said "Regression test exists and is disabled
pending this work: `tests/spirv/debug-function-scope-include.slang`", named a function
`findIncludingNonIncludedSourceFile` in `slang-lower-to-ir.cpp`, and described an `#include` resolution that
"**now** counts distinct includers ... and binds only when there is exactly one".

**None of it was on `master`.** `git grep findIncludingNonIncludedSourceFile HEAD` → 0 (non-zero control:
`isIncludedFile` in the same file → 9); neither cited test file existed. All of it lived only on the head of the
**open, draft** PR that the issue was the follow-up to. So two of the issue's four "symptoms" described the
behaviour of an unmerged branch, and one symptom's stated outcome was a property of an *intermediate, reverted*
approach — measured at `master`, all its shapes collapsed to the same fallback.

**Why this is a distinct failure mode.** The issue was written *from inside the PR's working context*, where those
files genuinely do exist. Present tense was true for the author and false for every later reader. It fails in the
"looks complete" direction: the claims are specific, correctly spelled, and cite real line numbers — they read as
*more* verified than vague prose, not less.

**Rules.**
1. **A file path in an issue is a claim about a REF.** Resolve it: `git ls-tree -r --name-only <ref> -- <path>` on
   `master` *and* on the referenced PR head (`git fetch origin pull/<N>/head`). "Test exists" and "test exists on a
   branch nobody has merged" are different facts with different next actions.
2. **The word "now" is a tell.** "The resolution now does X" is a temporal claim; ask *now on which ref?*
3. **Cross-check against the code that IS shipped.** Here `master`'s own comment at the binding site already named
   all four symptoms — the gap was real, but the *mechanism* the issue described for three of them was not shipped.
4. **When the issue is a deliberate follow-up, find the PR that spawned it.** Its state (draft/open/merged) and its
   `closingIssuesReferences` tell you whether the tracker is honest. Here the PR correctly carried no closing
   keyword — the partial-fix discipline had been followed; only the *tense* was misleading.

**Generalizes.** Same family as "an issue BODY is a frozen pre-triage snapshot": in both cases the body's text was
true when written and silently became false, and in both the stale version reads as the safe one. The check is
cheap — one `git ls-tree` per cited path — and it relocated the entire triage verdict here.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785945785507-a-bot-filed-issue-can-be-written-in-the-present-te.md`_
