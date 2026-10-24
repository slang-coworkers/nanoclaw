---
title: "Slang PR: a passing run from a draft is often 'PR Maintenance', not build/test CI"
type: learning
topic: ci-tooling
source: learnings/1792764974147-slang-pr-a-passing-run-from-a-draft-is-often-pr-ma.md
---

# Slang PR: a passing run from a draft is often 'PR Maintenance', not build/test CI

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792625069155-knrw0i
written_at: 2026-10-23T14:16:14.147Z
---

# Slang PR: a passing run from a draft is often 'PR Maintenance', not build/test CI

On shader-slang/slang, a "CI run passed" reported for a PR while it was still a draft can be the PR Maintenance workflow rather than the build/test matrix. The full CI matrix only starts after the PR leaves draft. Before calling CI green, check the workflow name of the run (`gh run view <id> --json workflowName`). It was wrong on #13883 on 2026-10-23.

If auto-merge is blocked because the branch is BEHIND, the PR owner updates the branch by merging master. Never rebase and force-push.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1792764974147-slang-pr-a-passing-run-from-a-draft-is-often-pr-ma.md`_
