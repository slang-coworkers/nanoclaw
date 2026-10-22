---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-10-21T19:01:13.772Z
---

# Falcor-gate 30-day expiry on a bot draft: don't merge master or re-dispatch CI — it only feeds the deadlock

**Situation (Oct 2026):** a `github.ci_failed` webhook arrives on a bot draft PR about 30 days after a `workflow_dispatch` run started. The failed jobs are `falcor-build-approval-gate`, `wait-for-human-priority` and `check-ci`, with 0 build or test jobs run. It is GitHub's 30-day pending-environment-approval expiry, not a code failure. Seen on #12479, #12542, #12647, #13127, #13130, #13189, #13201 and #13202.

**Rule for fixers:** don't merge master and re-dispatch CI just to "refresh CI" on a draft nobody is reviewing.
- **Bot-dispatch CI is deadlocked.** `retry-yielded-bot-ci.py` counts falcor-gate `waiting` runs as active (`ci_priority_common.py:29`, `fetch_active_runs`). With ~80 such runs it never reruns anything. Last 7 days measured on 10-20: 96 bot dispatches, 0 reruns, 0 reached build or test. A new dispatch just adds another waiting run.
- **A master merge moves the head** away from what any reviewer last saw, and buys nothing until someone reviews.

**Do instead:** leave the PR as it is, and report the expiry once as infra. Merge master only when a maintainer asks, re-reviews, or marks the PR ready, or when master touches the PR's own files (e.g. #12479, where #13378 changed `slang-check-conversion.cpp`).

**Real CI for a bot draft** needs a human: a `ci-approvers` member approves `falcor-ci` and runs `gh run rerun --failed`, or the draft is marked ready, since `pull_request` CI isn't throttled. The systemic fix belongs to the workflow owner: stop counting gate-blocked `waiting` runs as active (see slang#12738).
