---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786453650870-pwn340
written_at: 2026-08-11T13:38:26.297Z
---

# [approver/infra-abstain] A crashed production review still holds recoverable findings in its CI job log — mine it before falling to the Devin-only tier

# [approver/infra-abstain] A crashed production review still holds recoverable findings in its CI job log — mine it before falling to the Devin-only tier

**Symptom.** On shader-slang/slang#12459 @`c507078f64aa`, `collect-reviews.sh` reported `claude=n` and exit **10** (CodeRabbit stale only). The workflow's tier table maps that to "fall to Devin-only" — and Devin produced nothing, so the naive path is `ABSTAIN_INFRA:NO_REVIEW_SIGNAL` with an empty evidence section and nothing carried forward to the human.

But the production review **had run at the pinned head**. Workflow run `31443239896` ("Claude PR Review"), job `review`, conclusion `failure`:
`##[error]Claude result reported subtype success with is_error:true` / `"result": "API Error: Connection lost mid-response."` at 23:49:02Z, after 28 turns / 469.9s. It died *while aggregating*, so it never posted — which is precisely why the harvest saw nothing.

**Root cause.** The harvest is a **GitHub-artifact** probe: it asks "is there a posted review?" A review that ran and crashed produces **no artifact but plenty of output**. The tier table's exit codes (0/10/20/21/22) enumerate *harvest* outcomes, not *review-run* outcomes — there is no exit code for "ran and died", so it silently degrades to the same branch as "never ran" (20). Those two states have very different evidence available.

**How to catch it.** On any harvest that returns no primary review, check whether the review workflow *ran* on the pinned head before concluding it was skipped:
- `gh pr view <pr> --repo <repo> --json statusCheckRollup` → is there a `review` check-run, and is it `FAILURE` (ran and died) vs absent (genuinely skipped)?
- `gh run list --repo <repo> --commit <sha>` → find the "Claude PR Review" run id.
- `gh run view <id> --repo <repo> --log-failed` → the subagent results come back as JSON `tool_result` blocks; grep `is_error`, `🔴`, `Findings`, `severity`. **Delegate this to a subagent** — the log was 14,556 lines here.

On #12459 that recovered a full finding set the abstain would otherwise have thrown away: 1 hedged 🔴, 3 🟡 (incl. a criticality-5 "neither test can distinguish the new lowering from the old" — the exact positive-control gap my standing probes target), 1 🔵, and a clean security pass. **It also revealed which lens was missing:** `ir-correctness-reviewer` never returned — cut off mid-sentence on the very widening/unpack path the PR changes — while `cross-backend-reviewer` and `documentation-accuracy-reviewer` were never dispatched. "The review is incomplete" is far more actionable when you can name *which reviewer* is missing.

**Fix.**
1. A crashed review is **still `reviewers_complete:false`** — recovered partial findings do NOT restore a complete review signal, and must not be laundered into a WOULD_APPROVE. The abstain stands.
2. But an abstain is not an excuse to hand the human an empty page. Put the recovered findings in the review doc and the decision artifact so the human inherits the work instead of re-running it.
3. Distinguish, in the decision, **"never ran" from "ran and died"** — they imply different remediation (a skip rule vs. a flaky harness worth a re-run).

**Generalization (the transferable bit).** *A negative result from an artifact probe is a claim about the artifact, not about the work.* "No review was posted" ≠ "no review happened". Whenever a check reports absence, ask what would have to be true for the thing to have happened yet left no artifact — and probe *that* surface (the run log, the job, the process) before recording the absence as the finding.
