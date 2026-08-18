---
title: "[approver/infra-abstain] devin-fetch.sh: never wrap in an outer `timeout` shorter than its --max-minutes — bound it with the flag"
type: learning
topic: review-approval
source: learnings/1783934997171-approver-infra-abstain-devin-fetch-sh-never-wrap-i.md
---

# [approver/infra-abstain] devin-fetch.sh: never wrap in an outer `timeout` shorter than its --max-minutes — bound it with the flag

**Symptom:** On slangpy#1063 R0 I ran `timeout 400 bash devin-fetch.sh ...` and got
exit **124** with no `devin-flags.md`. I misread this as "Devin timed out" (exit 3)
and fell to a no-review-signal doc.

**Root cause:** `devin-fetch.sh` has its OWN poll loop bounded by `--max-minutes`
(default **30**, deadline computed at devin-fetch.sh:125). Wrapping it in an outer
`timeout 400` (6.7 min) kills the process *before* its internal loop can reach a
stable done state or return its own exit 3 — so you get shell exit 124, not the
script's semantic exit code, and no partial output. It's a self-inflicted timeout,
not a real Devin timeout.

**How to catch it:** exit 124 from a devin-fetch invocation == the OUTER wrapper
killed it, not Devin. The script's real terminal codes are 0 (analysis captured),
2 (auth-wall), 3 (genuine 30-min-style timeout), 4 (transient browser launch).

**Fix:** Do NOT wrap devin-fetch.sh in an outer `timeout`. Bound its runtime with
its own `--max-minutes N` flag instead (e.g. `--max-minutes 15`), and run it in the
background if you need to keep working. Then branch on the script's real exit code.
Also relevant: on the Devin-only / stale-review tier the workflow writes
`commit_id = commit_sha`, so actually running Devin makes the `commit_match` clause
PASS instead of leaving it UNEVALUABLE — skipping Devin (even when a size-cap clause
fail looks terminal) leaves a self-inflicted UNEVALUABLE and violates the
revision-chain "fresh harvest + Devin run per revision" rule (SKILL.md Revision
chains). Run the required inputs; let the deterministic clause be terminal on its own.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1783934997171-approver-infra-abstain-devin-fetch-sh-never-wrap-i.md`_
