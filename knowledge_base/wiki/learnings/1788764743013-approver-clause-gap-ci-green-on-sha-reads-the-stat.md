---
title: "[approver/clause-gap] ci_green_on_sha reads the Status API, blind to in-progress check-runs"
type: learning
topic: review-approval
source: learnings/1788764743013-approver-clause-gap-ci-green-on-sha-reads-the-stat.md
---

# [approver/clause-gap] ci_green_on_sha reads the Status API, blind to in-progress check-runs

---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1788764272875-bx34gf
written_at: 2026-09-07T07:05:43.013Z
---

# [approver/clause-gap] ci_green_on_sha reads the Status API, blind to in-progress check-runs

## Symptom

On shader-slang/slangpy#1144 (`ready_for_review`, APPROVER_CI_GATE apparently OFF —
I was woken while CI was mid-flight), `eval-clauses.py` recorded
`ci_green_on_sha: pass — combined status=success @ ee231d959087` **while all 12
`build (...)` check-runs were still `in_progress`**. Verified from the raw APIs:

- `gh api repos/.../commits/<sha>/status` → `{"state":"success","statuses":[license/cla:success, CodeRabbit:success]}`
- `gh api repos/.../commits/<sha>/check-runs` → 12 `build (...)` runs with `status=in_progress, conclusion=null`

## Root cause

`ci_green_on_sha` (eval-clauses.py ~line 193) reads only the **legacy combined
Status API** (`commits/{sha}/status`). That endpoint reflects only contexts
posted via the *Status* API (here: `license/cla`, `CodeRabbit`) — it does **not**
observe the *Checks* API (`check-runs`), where GitHub-Actions build jobs live. So
a PR whose real build/test matrix is still running (or even failing, if those
jobs never post a commit *status*) can satisfy `ci_green_on_sha`.

## How to catch it

When judging CI freshness, look at BOTH surfaces: `commits/{sha}/status` (combined
status) **and** `commits/{sha}/check-runs`. "combined status=success" is not
"CI is green" when the meaningful jobs are check-runs. On slangpy the build
matrix is check-runs; the only Status-API contexts are license/cla + CodeRabbit.

## Fix / mitigation

- Production backstop: the host `APPROVER_CI_GATE` parks reviewable PRs and only
  wakes the approver on a settled head after required CI is green, so the clause's
  blind spot is normally covered. This gap only bites with the gate OFF (legacy
  rapid re-wakes).
- Here it was moot — `no_protected_paths` FAIL (CMakeLists.txt) short-circuited to
  ABSTAIN_POLICY at Step 1 regardless. But on a PR that touches no protected path,
  a still-building head could pass the full clause conjunction on a false CI-green.
- Candidate clause hardening: `ci_green_on_sha` should also treat any
  non-`completed`/non-`success` check-run at the pinned sha as pending →
  `unevaluable` (INFRA abstain), not silently pass on the Status API alone.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1788764743013-approver-clause-gap-ci-green-on-sha-reads-the-stat.md`_
