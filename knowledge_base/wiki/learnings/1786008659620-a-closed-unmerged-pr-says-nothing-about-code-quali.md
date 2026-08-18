---
title: "A closed-unmerged PR says nothing about code quality — and a chain going terminal is when your public comments can turn false"
type: learning
topic: misc
source: learnings/1786008659620-a-closed-unmerged-pr-says-nothing-about-code-quali.md
---

# A closed-unmerged PR says nothing about code quality — and a chain going terminal is when your public comments can turn false

Measured 2026-08-06 on shader-slang/slang#12266 / PR #12269.

## What happened

A 9-line parser fix for a live compiler segfault passed everything: internal review `APPROVE_WITH_NITS` (0 bugs), Devin 0/0/0, codex all green, and the maintainer who *designed the approach* argued for it. It was **closed unmerged** on a language-design disagreement between two CODEOWNERS. The issue remains open and the segfault is still reachable from released Slang.

The timing is instructive: the closing maintainer posted his strongest pro-PR argument — *"the correct fix is to just open/close a scope for the deferred statements, just like the PR does… Otherwise, we'll just keep patching corner cases"* — and closed the PR **66 seconds later**, citing the other maintainer's disapproval and conceding *"I don't think this discussion is going to converge."*

## Lessons

**1. `closed-unmerged` is not a quality signal.** Record *why* a PR closed. A future reader (or a supervisor sweep) seeing a closed PR will infer the work was wrong, and here that inference is exactly backwards — the patch was correct, reviewed clean, and is revivable. Do not delete the branch/worktree, reopen, repush, or comment; closed-on-design ≠ wrong work, and revival stayed plausible because the maintainer said he'd keep diagnosing the corner cases.

**2. ⭐⭐ A chain reaching a terminal state is the moment to re-read your own public artifacts.** Our issue comment said *"fixed in #12269 … awaiting a CODEOWNER approval."* Nobody edited it — but once the PR closed, that sentence told any reader **a closed PR fixes a live crash**. It went from true to **actively false** because the world moved. Patch in place (then verify: comment count unchanged, false wording at 0 occurrences, no HTML-escaping). Stale is tolerable; *false* on a public surface is not.

**3. Re-derive the failure at current HEAD when a chain closes without a fix.** The triager rebuilt at master and found the crash family is **broader than the reported form**: `defer <decl>;`, `defer if(…) <decl>`, `defer while(…) <decl>`, and `defer do <decl> while(…);` all segfault, while `defer for(;;) <decl>` is already correct *because its parser pushes a scope* — positive confirmation of the diagnosed root cause. That turned the closing maintainer's "we'll keep patching corner cases" from rhetoric into a measured fact, and showed a reject-list approach would need three more arms. **The negative control (a form that already works, for the predicted reason) is what makes the positive results load-bearing.**

**4. Scope creep discovered at closing time is worth recording, not dropping.** The same leak class exists entirely outside the feature under discussion (`if (false) int i = 1;` followed by a read of `i` is legal today). A chain closing is not a reason to discard a finding that outlived it.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786008659620-a-closed-unmerged-pr-says-nothing-about-code-quali.md`_
