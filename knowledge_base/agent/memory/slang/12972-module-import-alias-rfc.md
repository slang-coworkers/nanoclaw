---
type: chain
title: slang#12972 — RFC: aliased imports + using decls (and its E30600 follow-up)
description: tangent-vector RFC, design-gated since 2026-09-08 (no fixer). 10-29 a commenter's E30600 point was spun out as a separate bot-filed diagnostic issue, owned by this chain.
tags: [front-end, name-lookup, module-system, rfc, design-gated]
---

# slang#12972 — separate module dependencies from name visibility

**RFC (design-gated).** Filed 2026-09-08 by tangent-vector (language lead). The triager (session
`sess-1788909318929-uhc5ue`, thread `gh-issue-shader-slang/slang-12972`) posted triage comment
5593245364 and set the type to Feature. I held the fixer: this is the lead's own RFC, and the #12550
precedent was ~10 days of implementation that was then withdrawn. **Reopens only on explicit
maintainer sign-off on the issue, or if the operator tells me to.**

**10-29 follow-up (comment 6509187499, albertrodriguezclo, no bot mention).** `ModA.twice` gives
E30600 "'ModA' is not accessible" for a `public` function. The triager found the root cause: the
`module ModA;` marker `ModuleDeclarationDecl` leaks into lookup (slang-lookup.cpp:78-91), and the
visibility filter then fires on the marker. This has existed since at least 2026.13.1. It can be
fixed separately from the RFC **only if the fix changes diagnostics alone.** Making `ModA` resolve
to the module is the RFC's decision.

**My decision (10-29):** use approach A (exclude the marker from lookup, add an E30015 note "names
a module", delete the dead ranking from #6483) plus C (a docs line). The triager files a
**bot-filed follow-up issue**, posts a short pointer on #12972, then hands the fix to slang-fixer
on the new issue's canonical thread. ⇒ **This chain owns the new issue's `issue_opened`, so it
needs no dispatch.** **Follow-up issue: #14063** (bot-filed 10-29 22:10Z; reply on #12972 is comment 6509491423). The fixer session `sess-1793311889218-do5wtj` owns `gh-issue-shader-slang/slang-14063`; the triager posted status comment 6509513474 there. **Its `issue_opened` needs NO dispatch.**

**10-29 22:28Z scope change (#14063).** The fixer found that the marker also *shadows* outer-scope
names. `module saturate;` + `saturate(x)` → E30015, and `module max;` imported + `max(..)` → E30600.
The implicit-module twins compile. So A also accepts some programs that are rejected today. The
change goes reject→accept only: nothing that compiles today breaks, and `ModA.twice` stays
rejected. **I chose (1): keep A and amend the scope.** The PR states the acceptance change in its
own section and pins it with tests. The triager patches its 3 public texts in place (the #14063 body,
cmt 6509513474, and #12972 cmt 6509491423). Rejected (2), B plus a separate issue, because it is a
consumer-side patch that keeps an accidental shape.

**10-30 00:16Z: draft PR #14074** (nv-slang-bot, head 144643baa, `Fixes #14063`, `pr: non-breaking`)
has an "Acceptance change" section and 14 tests under `tests/diagnostics/module-name-qualifier/`.
The triager confirmed all 3 public-text edits. Open item: the PR's Risk line points to an explanation
comment that has not been posted yet. The triager checks it before closing. Next: fixer peer review →
[Fix Report] → [Triage Resolution].
**10-30 01:19Z R1 review (slang-reviewer, head 144643b): APPROVE_WITH_NITS.** 0 bugs and 3 gaps:
the note fires on the implicit file-stem module name; the FileDecl import walk is untested; the
docs `public namespace` advice leaves members `internal`. The reviewer sent a tested remedy patch
straight to slang-fixer and made no GitHub post. The fixer owns the remediation, so no action from me.

**10-30 01:32Z: [Triage Resolution], the chain is parked on human review.** Draft #14074 head **2f735359a**
(11 commits, +439/−16) has all R1 gaps applied. Explanation comment 6511665717 is current, and the bot
status on #14063 is cmt 6511669033 (patched in place). CI run 40986003698 is "waiting" for a
maintainer gate. That is the fixer's figure and is not green. The 3 fp8-cuda INVALID_PTX failures
also fail on master. It reopens on a human comment, a reviewer verdict, or a CI event, all routed to the
fixer session through the pr-mapping. #12972 RFC hold is unchanged.
