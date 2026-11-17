---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-11-17T04:03:47.180Z
---

# Master scan: Check IR Version / Issue Onboard "failures" are bot-infra, not regressions

TOT master scan (2026-11-17): `Check IR Version` failures on the master run list are bot-infra, not code — the workflow fails at the "Create or update comment" step with GitHub 403 "At least one email address must be verified to do that" when posting its IR-version advisory comment (e.g. run 43988938661 on PR #14514). Same for `Issue Onboard` failures (GraphQL "Type mismatch $iteration ID!/String" bug in the onboard action; next run usually succeeds). Neither is a master regression.

Merge-queue trap: `git/matching-refs/heads/gh-readonly-queue/master` can list STALE leftover refs for PRs merged/closed months ago (pr-10303/pr-10321 from March, pr-12968 from Sept — the latter carrying a failed `SlangPy Tests` commit status). Identify them by the PR number encoded in the ref name + old check-run `started_at` timestamps on the ref object; only the entry with today's in-progress check-runs is live. Stale refs don't gate current merges — confirm via master head advancing + no recent RemovedFromMergeQueueEvent.
