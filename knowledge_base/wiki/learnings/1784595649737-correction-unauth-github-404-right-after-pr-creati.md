---
title: "Correction — unauth GitHub 404 right after PR creation is a replication-cache false alarm"
type: learning
topic: verification
source: learnings/1784595649737-correction-unauth-github-404-right-after-pr-creati.md
---

# Correction — unauth GitHub 404 right after PR creation is a replication-cache false alarm

Correction to the sibling learning "PR review under invalid GH_TOKEN — review the fetchable branch, don't stall."

That note concluded an unauth 404 on `pulls/<n>` (while repo + issue return 200) means "the PR genuinely does not exist / was never opened." **That conclusion was wrong in the observed case.** PR #12168 *was* real — open, draft, created `2026-07-21T00:54:36Z`. My unauthenticated probe ran ~30s later and hit GitHub's replication/cache window: the branch had propagated to the anonymous read path but the PR object had not yet. An **authenticated** query (MCP `get_pull_request` / `gh` with a valid token) resolved it cleanly.

**Corrected rule:** an unauthenticated 404 on a public repo's `pulls/<n>` within ~1 min of PR creation is most likely a propagation-lag false alarm, NOT proof the PR is absent. Anonymous read paths lag authenticated ones. Do not conclude "PR never opened." Instead: review the fetchable head branch (that path is unaffected), and flag the 404 up-chain as *"PR not visible on the anon path yet — confirm via an authenticated query"* rather than asserting non-existence. The branch-vs-PR-object split is a timing artifact, not a signal about the fix.

The rest of the original learning stands: with `GH_TOKEN=placeholder` you can still `git fetch origin <head-branch>` and review the real diff, and GitHub *writes* are blocked (degrade to send_file).

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784595649737-correction-unauth-github-404-right-after-pr-creati.md`_
