---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786366895972-aw1q2m
written_at: 2026-08-10T13:35:03.321Z
---

# [approver/infra-abstain] A CodeRabbit RATE-LIMIT REFUSAL looks identical to "no bot review" (harvest exit 20) — and combined /status reports it as SUCCESS

Measured on shader-slang/slang-rhi#823 @`d0964b150b9c`, 2026-08-10.

## Symptom

`collect-reviews.sh` on a 4-minute-old PR returned **exit 20** — the code meaning
"no harvestable bot review AND no review bot still working", i.e. the *legitimate*
Devin-only tier. Nothing in the exit code distinguished it from a genuine skip.

Falling to Devin-only there would have discarded the only real review signal:
CodeRabbit later posted **6 findings**, including the one both reviewers converged on.

## Root cause

CodeRabbit had already posted an `issue_comment` at 12:59:48Z:

> ⚠️ **Review limit reached** — `@author`, you've reached your PR review limit,
> so we couldn't start this review. **Next review available in: 15 minutes**

That is a *refusal*, not a review — so there is no review object, and no
`pending_bot` signal either (nothing is running). Hence exit 20, not 22.

Worse, the combined status endpoint reported it as green:

```
commits/<sha>/status -> {"state":"success",
  "statuses":[{"context":"license/cla","state":"success"},
              {"context":"CodeRabbit","state":"success"}]}
```

**`CodeRabbit: success` on a review that explicitly declined to run.** This is the
`/status`-folding trap in a new place: the context reports success for "I handled
this PR", which includes "I refused it".

## How to catch it

On **any** harvest exit 20 or 22, read the PR's issue comments before accepting a
tier decision. One MCP call:

`mcp__slang-mcp__github_get_pull_request_comments{owner,repo,pull_number}`

and grep the bodies for `Review limit reached` / `rate limited by coderabbit.ai`
(the body also carries the HTML marker `<!-- ... rate limited by coderabbit.ai -->`).
Exit 20 is only the legitimate Devin-only tier when **no such refusal exists**.

Timeline on #823: exit 20 @13:06 → (waited past the stated reset) → exit **22**
@13:18 (`pending_bot: CodeRabbit`) → poll 30s → exit **0** @13:19:55, head-current,
`stale:false`, 6 findings. Total wait ~14 min from PR open.

## Fix

- A rate-limit refusal is a **timing race with a stated deadline**, not a skip.
  The comment names the reset window ("15 minutes") — treat that number as the
  poll horizon, then re-harvest. Do not record a decision on the absence.
- Generalization: **a bot's "I'm not doing this" is not the same datum as "there
  is nothing to do", but both render as an empty result set.** Ask what a
  *declined* run would look like in your instrument — if it is byte-identical to a
  clean/absent one, the instrument cannot support the conclusion.
- Corollary for `/status`: never fold a combined status to answer "did X run?".
  A CLA stamp never reddens; a rate-limited review reports success. Enumerate the
  actual artifact (review objects, check-runs, `runs?head_sha=`).
