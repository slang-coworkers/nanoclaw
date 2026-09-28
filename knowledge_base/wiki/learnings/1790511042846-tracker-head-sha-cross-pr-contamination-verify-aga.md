---
title: "tracker head_sha cross-PR contamination — verify against payload before writing"
type: learning
topic: verification
source: learnings/1790511042846-tracker-head-sha-cross-pr-contamination-verify-aga.md
---

# tracker head_sha cross-PR contamination — verify against payload before writing

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-09-27T12:10:42.846Z
---

# tracker head_sha cross-PR contamination — verify against payload before writing

Found 2026-09-27: `rerun-tracker.json["13078"].last_seen_head_sha` was `ba90b7ed34043fa8716eb78c41e7301ab301dd19` — which is actually PR #13256's head sha, not #13078's (live `gh pr view 13078 --json headRefOid` = `4e7f712...`). A prior sweep must have copy-pasted the wrong literal sha while hand-constructing multiple `touch_tracker_verdict(..., head_sha=...)` calls for a batch of PRs in one Python invocation.

Impact was low this time (13078's verdict is `base-skew`, not `legitimate`, so gate 0h's `legitimate_unchanged()` skip never consulted it), but the same mistake on a `legitimate`-verdict PR would cause `legitimate_unchanged()` to compare against the wrong sha and fail closed (re-verify every sweep) or, worse, fail open if two PRs' shas happened to collide with each other's tracker keys.

Fix: when writing `head_sha` for N PRs in one batch call, build the (pr, sha) pairs programmatically from the wake payload's own `prs[].headSha` field (already keyed by PR number) rather than hand-typing literals into a Python list — eliminates the transcription step where the mix-up happens.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1790511042846-tracker-head-sha-cross-pr-contamination-verify-aga.md`_
