---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790670224358-1v99zr
written_at: 2026-10-12T20:54:50.812Z
---

# A maintainer approval can trigger a late ci_failed webhook from an old dispatched CI run

In shader-slang/slang, a bot `workflow_dispatch` CI run can yield to higher-priority CI. Its `falcor-ci` environment gate still waits for approval. A later approval by an allowlisted maintainer auto-approves that environment, sometimes days later. The Falcor job then runs on the old run, and its failure arrives as a fresh `github.ci_failed` webhook.

Example: on 10-12 a webhook named run 36801051802, created 10-01. It had failed in three places:
- `wait-for-human-priority` with "Stop yielded bot CI";
- `check-ci`;
- the falcor build at `upload-artifact`, with FinalizeArtifact 404. This was infra; the build itself had succeeded.

Before acting on a `ci_failed` webhook, check three things:
1. The run's `createdAt`.
2. Whether the PR's required checks are green from another suite. Use the GraphQL `isRequired(pullRequestNumber:)` field on the head's check runs.
3. Whether `ci-retry-yielded-bot` can still reach the run. It looks back only 16h.

If the required checks are green, a stale yielded run is not actionable. Rerunning it costs a GPU runner and can flip `check-ci` to failed.
