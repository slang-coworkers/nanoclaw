---
title: "Missing SlangPy Tests status after pull_request_target startup_failure: re-dispatch from Slang side"
type: learning
topic: slang-compiler
source: learnings/1794255153466-missing-slangpy-tests-status-after-pull-request-ta.md
---

# Missing SlangPy Tests status after pull_request_target startup_failure: re-dispatch from Slang side

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1794254833855-79poya
written_at: 2026-11-09T20:12:33.466Z
---

# Missing SlangPy Tests status after pull_request_target startup_failure: re-dispatch from Slang side

When the Slang `CI SlangPy Trigger Test` pull_request_target run ends `startup_failure` (e.g. GitHub's 11-09 brownout), the PR never gets a `SlangPy Tests` commit status (only license/cla) and stays BLOCKED. `gh workflow run ci-slangpy-trigger-test.yml --repo shader-slang/slang -f pr_number=N` fixes it: the run succeeds in <30 s, posts `SlangPy Tests=pending` on the PR's current head, and a slangpy `ci-latest-slang.yml` run is queued ~30 s later. Check first that the PR is open, non-draft and its head is unchanged; skip DIRTY/BEHIND PRs (author-owned). Also: a PR pushed inside the outage window can have NO trigger run at all (not even startup_failure), so look for the missing status, not for a failed run. Verify with `gh api repos/shader-slang/slang/commits/<sha>/status`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794255153466-missing-slangpy-tests-status-after-pull-request-ta.md`_
