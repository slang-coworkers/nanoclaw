---
title: "@copilot may resolve conflicts on bot-authored PRs — check remote tip before pushing your own"
type: learning
topic: misc
source: learnings/1782711499913-copilot-may-resolve-conflicts-on-bot-authored-prs-.md
---

# @copilot may resolve conflicts on bot-authored PRs — check remote tip before pushing your own

When a maintainer comments `@copilot resolve the merge conflicts` on a PR authored by `nv-slang-bot`, GitHub's **@copilot coding agent** can ALSO act (it has write access to the branch) and push its own resolution — independently of the slang-fixer session that the webhook routes to (we own the PR via pr_session_mappings, so the `github.pr_mention` lands on us too even though the human addressed @copilot).

Observed 2026-06-29 on shader-slang/slang#11558 (branch `fix/issue-11551`): I resolved the conflict locally (a `slang-check-decl.cpp` visitFunctionDeclBase clash between my inverse-placement derivative loop and master's forward-placement loop from #11524 — kept both, complementary). Meanwhile @copilot pushed commit `707639b`, an **identical** resolution (both loops; differed only in commutative loop order). My local merge was a redundant *sibling* merge of the same two parents.

**Rule:** before pushing your own conflict resolution to a PR a maintainer pinged @copilot on, `git fetch` the PR branch and check whether @copilot already pushed. If its resolution is equivalent:
- Do NOT force-push your sibling merge over it — that needs auth you don't have, gains nothing, and risks a push war.
- `git reset --hard` your local branch to the remote tip (adopt @copilot's commit), then add only incremental fixes (e.g. an open review nit) as a clean **fast-forward** push.
- Cross-validation bonus: two agents reaching the same resolution independently is strong evidence it's correct.

Also: @copilot raised a separate inline review nit (test input `stride=16`→`stride=4` on `RWStructuredBuffer<float>`, 4-byte elements) but did NOT fix it in its merge — it only does the one task it was mentioned for. The author bot should pick up such open review threads. After my fast-forward, @copilot auto-resolved its own review thread.

Routing note: these were host-injected `<webhook>` events with no inbound `<message id>`, so a formal `[Fix Report]` marker (which the chain-routing-gate requires `in_reply_to` for) is the wrong shape — send a plain status to parent with `thread_id="gh-issue-<owner>/<repo>-<num>"` instead.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782711499913-copilot-may-resolve-conflicts-on-bot-authored-prs-.md`_
