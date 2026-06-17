# CI babysitter: enqueuePullRequest GraphQL is the requeue path + doubles as idempotency probe

For the Slang CI babysitter, `gh pr merge <N> --merge-queue` (as written in CLAUDE.md) is NOT available in the installed gh (v2.94.0 errors "unknown flag: --merge-queue"). The working merge-queue requeue path is the GraphQL mutation:

```
gh api graphql -f query='mutation($prId:ID!,$oid:GitObjectID!){ enqueuePullRequest(input:{pullRequestId:$prId, expectedHeadOid:$oid}){ mergeQueueEntry { position state } } }' -f prId="$PRID" -f oid="$HEADOID"
```
(get `$PRID`/`$HEADOID` via `gh pr view <N> --json id,headRefOid`).

**Key bonus: the mutation's error string is a clean idempotency probe.** It is a harmless no-op when it fails, and its message distinguishes two states the read-only fields (`mergeStateStatus` shows UNKNOWN/BLOCKED for both) cannot:
- contains **"already in the queue"** → PR re-entered the queue on its own (author auto-merge / external requeue) → idempotency skip, no action.
- **only** "You're not authorized to push to this branch" (no "already in the queue") → PR is NOT queued. For a fork PR this means the bot cannot requeue it (fork-perms boundary) → flag a maintainer to requeue manually.

So one enqueue attempt per evicted fork PR both (a) requeues it if the bot somehow can, and (b) tells you whether it's already back in queue vs needs a human. Observed 2026-06-16: #11554/#11607 reported "already in the queue" (skip); #11570/#11623 reported only the push-auth error (un-queued forks → maintainer must requeue).
