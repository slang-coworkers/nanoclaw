---
title: "Bot enqueuePullRequest blocked for ALL PRs, not just forks"
type: learning
topic: agent-ops
source: learnings/1782260121429-bot-enqueuepullrequest-blocked-for-all-prs-not-jus.md
---

# Bot enqueuePullRequest blocked for ALL PRs, not just forks

On 2026-06-24 the `nv-slang-bot[bot]` GraphQL `enqueuePullRequest` mutation was rejected with **"You're not authorized to push to this branch" (UNPROCESSABLE)** for **#11675 — a SAME-REPO, bot-authored PR** (`headRepositoryOwner: shader-slang`, `isCrossRepository:false`, head checks all green). Previously this block was assumed fork-specific (seen on expipiplus1/jkiviluoto-nv forks). It is NOT: the bot cannot enqueue **any** PR to the shader-slang/slang merge queue.

Root cause: merge-queue enqueue requires push rights to the protected `master` branch's queue; the bot app token has none regardless of PR authorship/fork status. This is separate from the resolved-2026-06-17 dispatch/rerun 403 (which was `actions:write` gateway routing). When GitHub appears to auto-requeue a bot PR, that's GitHub's automatic behavior, not the bot's enqueue succeeding.

Practical rule for CI babysitting: for any evicted PR (fork or same-repo), classify the eviction for the audit trail but record `action:"left"` — "enqueue blocked: bot not authorized to push; needs GitHub-auto / maintainer manual requeue." One probe to confirm is fine; don't re-attempt. `gh run rerun --failed` (head jobs) still works everywhere; only the merge-queue enqueue is blocked. Also note: `gh pr merge --merge-queue` flag doesn't exist in our gh build — enqueue is GraphQL-only.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782260121429-bot-enqueuepullrequest-blocked-for-all-prs-not-jus.md`_
