---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787819591831-7rhs8i
written_at: 2026-08-27T08:50:41.277Z
---

# [approver/confirmed-safe] make-a-check-non-required PR: widening-vs-removal is the axis, not new-flag

## Symptom / context
shader-slang/slang #12775 "ci: make test-falcor non-required in check-ci" — removes `test-falcor` from the `check-ci` aggregate job's required `needs:` list (+6/−1 in `.github/workflows/ci.yml`), adds a comment documenting why. Decided WOULD_APPROVE @ d3346bc2; a MEMBER reviewer (jvepsalainen-nv) had already APPROVED "LGTM" at the exact head, so the call matched the human channel.

## The transferable lesson (sharpens Step-0 recall)
When a PR REMOVES a job from `check-ci.needs` (makes a check non-required), the prior false-safe rule ("removing a required check weakens the merge gate; green-CI can't see it") is real but does NOT by itself route to ABSTAIN. It routes to WOULD_APPROVE when this conjunction holds — probe each:
1. **The loosening IS the declared intent.** Title/body say "make X non-required". The diff removes exactly that one `needs:` element and nothing else. Not a change disguised as benign.
2. **The removed job still runs + reports.** Grep the job body at head — the job, its build dep, any approval gate are untouched; it's non-blocking, not deleted. A future regression stays VISIBLE.
3. **Nothing is masked right now.** The removed check is *green* on the head (`commits/<sha>/check-runs`), and the aggregate `check-ci` is `success`. If the removed check were currently RED, the PR would be papering over a live failure — that's the ABSTAIN case.
4. **Trusted + owned.** Author MEMBER/OWNER; removing a required check is a maintainer operational-policy call. A human MEMBER approval at the exact head is strong corroboration.
5. **Reversible + documented** (comment says "promote back once settled").

## How this differs from the gate/flag standing probe
The standing new-flag/new-gate probe (positive control required) targets a PR that ADDS a flag and gates work on it — failure direction = silent always-skip. A make-non-required PR is the opposite direction (removal from an aggregate gate); no new flag, no dead-flag risk, so that probe does NOT apply. Don't demand a trigger-present control here.

## Slang-specific facts used
- "Required" in slang = membership in `check-ci.needs` (ci.yml), NOT the branch-protection UI. `check-ci` `exit 1`s if any needed job != success.
- Reading which checks are required: read `check-ci`'s `needs` list; `gh api .../branches/master/protection` 403s the bot token.
- To verify "not masking now": aggregate `check-ci` conclusion on the head + the removed job's own conclusion; failing check-runs that are absent from `check-ci.needs` (e.g. `test-windows-*-cl-aarch64`, `check-pr-label`) do not gate merge.
