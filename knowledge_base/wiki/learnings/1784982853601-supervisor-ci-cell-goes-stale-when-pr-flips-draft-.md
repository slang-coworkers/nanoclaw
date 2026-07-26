---
title: "Supervisor CI cell goes stale when PR flips draft→non-draft"
type: learning
topic: agent-ops
source: learnings/1784982853601-supervisor-ci-cell-goes-stale-when-pr-flips-draft-.md
---

# Supervisor CI cell goes stale when PR flips draft→non-draft

**Rule:** Before sending a CI-rebase nudge on a PR-bearing chain, re-check `isDraft` — the authoritative CI signal depends on it, and a stored CI cell from a prior tick can be stale if the PR's draft status changed since.

**Why:** The supervisor's §2b CI read (reference.md → *CI status + rebase nudge*) assumes our fix PRs sit in **draft** and drive CI by `workflow_dispatch`, so it takes "latest non-skipped `workflow_dispatch` run for `fix/issue-<num>`" as the signal. But once a PR flips to **non-draft** (maintainer/fixer readies it, or it's under review), the `wait-for-human-priority` gate no longer yields for it — yet a stale `workflow_dispatch` run dispatched *while it was still a draft* remains the "latest workflow_dispatch" and can carry a `failure` conclusion (real flaky jobs + `check-ci` fail). On a non-draft PR the authoritative run is the **`pull_request`** run on the same HEAD, not the workflow_dispatch one.

**Incident (2026-07-25, Tick 102, slang #12120 / PR #12195):** Prior tick recorded CI cell `❌` (run 30012826009, workflow_dispatch) when the PR was a draft. This tick the PR was non-draft; the stored `❌` triggered a rebase nudge. Fixer pushed back correctly: the `pull_request` run 30012810175 on the same HEAD `8bead6c9cf` was `success` (green); the workflow_dispatch run was redundant cosmetic red (flaky macOS-aarch64 test-slang + Falcor). PR was `BLOCKED`/`REVIEW_REQUIRED` on human review + a maintainer naming decision, NOT CI. Nudge was retracted.

**How to apply:**
1. In §2b, when the PR is **non-draft**, prefer the latest non-skipped **`pull_request`** run's conclusion as the CI cell; treat the workflow_dispatch run as non-authoritative.
2. Don't act on a stored `❌`/`✅⤵️` cell without re-confirming the run is still the latest AND the PR's draft-status hasn't changed since it was recorded.
3. A rebase nudge on a PR that's `BLOCKED`/`REVIEW_REQUIRED` with real CI already green is noise — the block is human review, not CI.

Relates to the cosmetic-red / bot-PR-yield pattern already in memory (workflow_dispatch priority-yield reds).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1784982853601-supervisor-ci-cell-goes-stale-when-pr-flips-draft-.md`_
