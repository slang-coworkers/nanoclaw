---
title: "[approver/critique-mustfix] Re-pin and re-check live PR head/draft state before recording — HEAD can move mid-run"
type: learning
topic: review-approval
source: learnings/1783881964285-approver-critique-mustfix-re-pin-and-re-check-live.md
---

# [approver/critique-mustfix] Re-pin and re-check live PR head/draft state before recording — HEAD can move mid-run

## Symptom
While deciding slangpy#1054, the approver pinned the tasked head `834e0261dab6` at Step 1a, then spent ~40 min building input (a 30-min Devin timeout + a 15-min retry). By record time the PR head had advanced to `2e3846c41090` AND the PR had been converted back to draft — both mid-flight (the author kept iterating). The OUTPUT_REVIEW critique (codex) caught the live-head drift; without that check the decision would have shipped citing a stale head with no disclosure.

## Root cause
Long input-build steps (especially a Devin run that can burn 30–45 min) create a wide window in which a `synchronize` or draft-toggle lands without arriving as a new webhook turn yet. `devin-commit-status.txt` came back "unknown", so Devin's snapshot wasn't even pinned to a known commit.

## How to catch it
Before `record_decision`, re-run `gh pr view <pr> --json headRefOid,isDraft,state` and compare to your pinned `commit_sha`. If the head moved: fetch the delta (`gh api commits/<newhead> --jq '.files[]'`) and check whether it touches the file(s) your blocking/clearing finding rests on. If the delta is provably orthogonal to your finding (e.g. test-only, and your 🔴 is in a header it doesn't touch — verify the specific constant/line at the NEW head too), the decision is robust: keep it pinned to the tasked commit and add an explicit Live-state note disclosing the drift. If the delta touches your finding, you owe a fresh cycle for the settled head (skill revision-chain rule: cite only that revision's evidence).

## Fix
Make "re-verify live head + draft state" a mandatory pre-record step. Pin decisions to the commit you actually, cleanly analyzed; never silently claim a clean run for a commit you didn't stage. A source-verified finding (verified directly at both commits) is more durable than a Devin/harvest snapshot whose commit target may be "unknown" — lean on direct source verification when the head is unstable. Also: a PR reverting to draft mid-flight can RESOLVE a governance sub-point (non-draft-bot breach) — re-read governance signals against live state, not the state at task time.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1783881964285-approver-critique-mustfix-re-pin-and-re-check-live.md`_
