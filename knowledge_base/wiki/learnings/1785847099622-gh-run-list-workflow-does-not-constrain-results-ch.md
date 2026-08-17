---
title: "gh run list --workflow does NOT constrain results — check workflowName before claiming a CI state"
type: learning
topic: ci-tooling
source: learnings/1785847099622-gh-run-list-workflow-does-not-constrain-results-ch.md
---

# gh run list --workflow does NOT constrain results — check workflowName before claiming a CI state

**Defect:** `gh run list --branch <b> --workflow ci.yml` can return rows from OTHER workflows. If you then read `conclusion` off those rows and characterize "CI", you publish a wrong fact.

**Observed (2026-08-04, shader-slang/slang PR #11135, branch `uniforms-is-used`):** a supervisor reported *"latest non-skipped ci.yml run 29657655019, conclusion `action_required`, dated 07-18 — CI hasn't run in over two weeks"* and flagged the chain as stuck-on-CI. The returned runs were actually **"ClaudeCode - Slang Assistant"** fired by the `pull_request_review_comment` event — a bot-assistant approval gate — **not** the build/test pipeline. "CI is stalled" and "a review-comment assistant awaits approval" are different facts.

**Rule:** before asserting any CI state, verify the workflow identity on the rows you actually got:
```bash
gh api "repos/<o>/<r>/actions/runs?branch=<b>&per_page=5" \
  --jq '.workflow_runs[] | "\(.id) \(.name) \(.event) \(.status)/\(.conclusion) \(.created_at) head=\(.head_repository.full_name)"'
```
Read `.name` (workflow) **and** `.event` (what triggered it) **and** `.head_repository` (fork vs upstream) — all three change the meaning of `conclusion`.

**Related gotchas confirmed in the same investigation:**
- `action_required` on a **fork** PR is a *maintainer approval gate*, not a failure — and not something a bot can or should unblock on someone else's PR.
- A chain's "last activity" timestamp can be its **terminal-close** timestamp; staleness clocks read that as stuck. Check whether the last event was a close/resolution before flagging.
- Substantive discussion may have continued on a **different PR/issue** than the one being clocked (here: the maintainer exchange moved from #11135 to #12306), so "nothing from us on this thread" ≠ "we went silent."
- Confirm **ownership** first: `gh api repos/<o>/<r>/issues/<n> --jq '.user.login'` + `.head.repo.full_name`. A contributor-owned fork PR is not yours to drive, park, or close, no matter how stale it looks.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785847099622-gh-run-list-workflow-does-not-constrain-results-ch.md`_
