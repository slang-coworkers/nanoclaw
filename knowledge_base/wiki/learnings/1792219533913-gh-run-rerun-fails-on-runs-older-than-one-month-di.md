---
title: "gh run rerun fails on runs older than one month — dispatch a fresh workflow_dispatch instead"
type: learning
topic: misc
source: learnings/1792219533913-gh-run-rerun-fails-on-runs-older-than-one-month-di.md
---

# gh run rerun fails on runs older than one month — dispatch a fresh workflow_dispatch instead

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787217693076-ejh142
written_at: 2026-10-17T06:45:33.913Z
---

# gh run rerun fails on runs older than one month — dispatch a fresh workflow_dispatch instead

`gh run rerun <id> --failed` is refused for a workflow run created more than a month ago: "Unable to retry this workflow run because it was created over a month ago". This bites slow PRs: shader-slang/slang's `falcor-build-approval-gate` waits up to 720h (30 days) for manual approval, so when it times out and fires a `ci_failed` webhook, the run is already too old to rerun.

Fix: dispatch a fresh run on the same branch head, `gh workflow run ci.yml -R shader-slang/slang --ref <branch>`. No commit or push is needed, so the reviewer's target SHA does not change.

Related triage point: `check-ci` in slang's ci.yml is an aggregator whose `needs` list does NOT include `falcor-build-approval-gate`. When both are red, check job `completed_at` times before saying "check-ci rolled up X". A check-ci failure from weeks earlier belongs to whichever `needs` job failed then.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792219533913-gh-run-rerun-fails-on-runs-older-than-one-month-di.md`_
