---
title: "[approver/clause-gap] ci_green_on_sha reads the legacy combined-status API and passes while Actions CI is still pending"
type: learning
topic: review-approval
source: learnings/1785856317379-approver-clause-gap-ci-green-on-sha-reads-the-lega.md
---

# [approver/clause-gap] ci_green_on_sha reads the legacy combined-status API and passes while Actions CI is still pending

**Symptom.** On shader-slang/slangpy#1078 @ b76c8065612d, `eval-clauses.py` reported `ci_green_on_sha = pass, "combined status=success"` while `gh pr checks` showed the actual builds as **5 success / 5 in_progress / 3 queued** — CI was still running, not green.

**Root cause.** `eval-clauses.py:187` reads the **legacy combined-status** endpoint `repos/{repo}/commits/{sha}/status`. GitHub Actions check-runs do **not** appear on that surface. On slangpy the only thing publishing a legacy commit status is the CLA bot, so the endpoint returns exactly one context — `license/cla: success` — and `state` rolls up to `success`. The clause is effectively asserting "the CLA is signed", not "CI is green".

The `unevaluable` branch for pending CI already exists (`eval-clauses.py:193-195`); it simply never fires, because the pending Actions runs are invisible to the endpoint being polled.

**Why it matters (false-safe generator).** This did not change PR#1078's outcome — `author_trust` FAILed and a FAIL dominates an UNEVALUABLE — so the miss was masked. But on a PR from a **trusted** author (OWNER/MEMBER/COLLABORATOR), a pending, queued, or never-run Actions pipeline reads as green and contributes a `pass` to a `WOULD_APPROVE` conjunction. Worse case is a repo where Actions never ran at all: no check-runs, one CLA status, clause says green. That is the highest-severity shape this clause can fail in, and it is silent.

Related: the host `APPROVER_CI_GATE` is documented as waking the approver only once required CI is green. I was woken on a head whose builds were still queued — so either the gate was off for this dispatch, or the gate reads the same misleading surface. Worth checking on the host side too.

**How to catch it.** Don't trust a single-context `combined status=success`. Cross-check the two surfaces:
```
gh api repos/{repo}/commits/{sha}/status  --jq '{state,total:.total_count,ctx:[.statuses[].context]}'
gh api repos/{repo}/commits/{sha}/check-runs --jq '[.check_runs[]|{c:(.conclusion // .status)}]|group_by(.c)|map({state:.[0].c,count:length})'
```
If `total_count` is small (1-2) and the contexts are only bot plumbing like `license/cla`, the combined status is not reporting CI. `gh pr checks <pr>` is the quick human-readable version.

**Fix.** `ci_green_on_sha` must consult **check-runs** (or `gh pr checks` / the statusCheckRollup GraphQL field) and merge with the legacy statuses: any check-run `queued`/`in_progress` ⇒ `unevaluable` (pending); any `failure`/`timed_out`/`cancelled` ⇒ `fail`; `pass` only when every required check has a terminal success **and at least one real CI check exists**. A zero-CI-check sha should be `unevaluable`, never `pass`.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785856317379-approver-clause-gap-ci-green-on-sha-reads-the-lega.md`_
