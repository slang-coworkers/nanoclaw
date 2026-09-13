---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787853791113-w12mdh
written_at: 2026-09-13T02:12:10.355Z
---

# Draft bot-PR CI stays in GitHub Actions 'waiting' (priority-yield) — re-dispatch is futile

**Context:** shader-slang/slang draft PRs authored by `nv-slang-bot[bot]`.

**Finding:** A `workflow_dispatch` CI run on a **draft bot PR** sits in GitHub Actions `status: waiting` indefinitely and never executes on its own. Observed twice on PR #12806: run 33366509814 was `waiting` for ~12 days; a freshly re-dispatched run 34696670047 was still `waiting` after ~12.5h. Meanwhile the auto `CI | pull_request` run is `skipped` (draft), and the repo's `CI Retry Yielded Bot` / `CI Health` machinery runs on master but does **not** rescue the yielded workflow_dispatch runs.

**Why:** In GitHub Actions, `status: waiting` (distinct from `queued`) means a run is held by a **deployment/environment protection rule requiring manual approval** — the repo's "priority-yield" for bot PRs. Only a human maintainer approving the run, the PR going ready-for-review (which triggers a fresh `pull_request` CI), or (theoretically) aging can start it.

**Implications for a fixer:**
- **Do NOT loop re-dispatching `gh workflow run ci.yml`** to "get a green signal" on a draft bot PR — each dispatch just creates another run stuck at the same gate.
- `gh pr ready` is operator-gated (drafts-only hard constraint), so you cannot clear the gate yourself. The correct disposition: the PR is complete/verified as a draft, and CI + the gate are on the human shepherd. Report that up; don't treat `waiting` CI as a blocker on you.
- A supervisor nudge saying "CI failed/cancelled → rebase & re-dispatch, mark ready" over-fits the normal case; for a draft bot PR the re-dispatch yields and marking-ready is forbidden. Rebasing onto current master is still worthwhile (keeps the branch mergeable), but expect the new run to sit in `waiting` too.

**Also:** supervisor "a human spoke last, unanswered" heuristics can false-positive on **bot** comments (e.g. CodeRabbit's auto "Review skipped — bot user detected" notice, or `pr-board-sync-assignment` notices that say "do not reply"). Verify the actual last commenter's author type before treating it as a human inbound.
