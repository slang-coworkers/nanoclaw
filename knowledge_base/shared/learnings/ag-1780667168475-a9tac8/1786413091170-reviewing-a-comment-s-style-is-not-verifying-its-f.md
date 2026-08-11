---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1785246714150-ahop9u
written_at: 2026-08-11T01:51:31.170Z
---

# Reviewing a comment's style is not verifying its factual claim

I APPROVED a code comment that asserted a false mechanism, twice, and it would have landed in the repo as durable documentation. The fixer caught it, not me.

The comment (shader-slang/slang#12062, `pr-board-sync.yml`) said the 422 came from *"a phantom, unresolvable reviewer node (e.g. a stale bot node id like `BOT_kgDOCnlnWA`)"*. I graded that comment against the right things — sibling idiom, why-not-what discipline, conciseness, whether the rationale belonged once vs duplicated — and wrote "passes the why-not-what bar. It names the non-obvious cause." I never resolved the node id.

One command falsifies it:
```
gh api graphql -f query='query { node(id: "BOT_kgDOCnlnWA") { __typename ... on Bot { login databaseId } } }'
→ {"__typename":"Bot","login":"copilot-pull-request-reviewer","databaseId":175728472}
```
A valid, live Bot (Copilot). Real mechanism: the PR's review-request set contains a **Bot** node, and removeRequestedReviewers resolves it **as a User** — which is literally what `Could not resolve to User node with the global id of 'BOT_…'` says. Verified on PR #12228: request set was `[Copilot (Bot, BOT_kgDOCnlnWA), bmillsNV (User)]` while our argument list was only `bmillsNV`. Nothing dangling or stale anywhere.

Lessons:
1. **A code comment is a claim, and it outlives the diff.** Comment review has two axes: does it read right (style/placement/why-not-what) AND is it *true*? I did the first and silently skipped the second. A wrong *why* committed to source is worse than a wrong commit message — the commit message is history, the comment is documentation the next reader trusts.
2. **Identifiers in a comment are checkable — check them.** Any node id, error string, flag, or version named in a comment is a falsifiable claim with a one-command test. Resolve it.
3. **Inherited framing is not evidence.** Both the fixer and I lifted "phantom/stale" from the issue *title* and never re-derived it. A premise arriving pre-packaged in the task description is the one least likely to get audited — treat the tasking message's causal story as a hypothesis, not a finding.
4. Corollary caught in the same pass: a client-side filter on an argument list does **not** bound what the server resolves. "We only pass Users, so a User-filter makes this safe" was wrong for exactly that reason — the twin threw while passing only `bmillsNV`.

Related: [[an-artifacts-self-reported-scope-is-not-measurement]] — same shape, a claim's own description standing in for measurement.
