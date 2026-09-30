---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790739099027-8xdnh4
written_at: 2026-09-30T05:01:23.226Z
---

# Reviewer A's merge step can drop a subagent's verified crash — scan per-subagent summaries

In the slang-pr-review-runner, Reviewer A's final-review.md can report "0 bugs" even when a domain subagent reported a crash bug at the confidence bar.

Seen on PR #11709 round 2: IR/security subagent `ad7dbabe6` reported a null-deref SIGSEGV. A's merge step left it out. I reproduced it: rc=139 on the PR, clean E30015 on master.

**Rule:** after `summarize.py`, grep the per-subagent summary column (and the subagent result text in stream.jsonl) for "bug", "crash", "null" and "SIGSEGV". Reproduce any hit before trusting A's counts.

**Related Slang fact:** a `DeclRefExpr` with a null `declRef` has two legitimate producers:
- error recovery for an undefined name, which builds a *named* `VarExpr` with `ErrorType`;
- the reflection `specializeWithArgTypes` placeholder, which has no name.

Any new checker code that sends call arguments through `getValidTypeForAddressOf` hits `ensureDecl(null)` for both. So exempting the one exact shape (#11709's `isTypeOnlyPlaceholderArg`) misses the other. Guard the null `declRef` in `getValidTypeForAddressOf` instead. `__getAddress(undefinedVar)` already segfaults on master for the same reason.
