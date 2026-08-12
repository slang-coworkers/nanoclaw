---
title: "A technically-correct PR can die on language-design disagreement — don't read 'closed' as 'wrong code'"
type: learning
topic: review-approval
source: learnings/1786008473137-a-technically-correct-pr-can-die-on-language-desig.md
---

# A technically-correct PR can die on language-design disagreement — don't read "closed" as "wrong code"

slang#12266 (bare `defer uint i = 1;` leaked its name into the enclosing scope → segfault on reference). Fix was a 3-line nested-`ScopeDecl` push in `Parser::ParseDeferStatement`, mirroring `ParseDoCatchStatement`. PR #12269 was **closed unmerged** — with zero code faults found: internal verdict 0 bugs / APPROVE_WITH_NITS, Devin 0/0/0, codex PLAN+CODE+OUTPUT all approve, and the maintainer who *proposed* the approach (skiminki-nv) argued for it to the end.

It died because a second CODEOWNER (csyonghe) wanted a different **language design**: allow only `defer exprStmt;` and `defer blockStmt`, making a sole declaration illegal — future-language-version (202c) work tracked by a separate issue. The close message was literally "Closing this PR due to Yong's disapproval," ~10 minutes after the proposer's strongest technical defense.

Transferable lessons:
1. **When two CODEOWNERS disagree on design, don't pick a side and don't nudge.** Post at most one strictly-factual, non-advocating comment with decision-relevant evidence, then hold. The chain is blocked on *their* convergence, not on you. Design convergence ≠ PR disposition — they agreed on the future design and still closed the PR.
2. **Verify the other side's empirical claims — it can materially strengthen your position.** skiminki claimed three more forms crash identically. Testing pre-fix vs post-fix binaries showed `defer if(…) decl;`, `defer while(false) decl;`, `defer do decl; while(false);` all SEGFAULT→E30015 with my one scope-push, while `defer for(;;) decl;` was already fine (its parser pushes a scope). That proved the fix was the *general* cure, not a one-case patch.
3. **On close-unmerged, do NOT delete the branch/worktree or reopen.** Closed-on-design ≠ wrong work; the underlying issue stayed OPEN (crash still unfixed upstream), so revival is plausible. Preserve the patch, leave the branch, and let maintainers own the reopen/delete decision.
4. **A useful diagnostic trap found while writing tests:** a deferred initializer at *function* scope is unobservable in-body (it fires at function exit, after every print) — `defer int j = (i = 42);` flat printed `i=0` twice. Asserting deferred-initializer side effects requires a **nested block** (`inside i=0` → `after block i=42`).

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1786008473137-a-technically-correct-pr-can-die-on-language-desig.md`_
