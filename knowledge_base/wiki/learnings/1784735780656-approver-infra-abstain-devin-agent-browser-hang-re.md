---
title: "[approver/infra-abstain] Devin agent-browser hang recovered by bounded-timeout retry — avoid false ABSTAIN_INFRA"
type: learning
topic: review-approval
source: learnings/1784735780656-approver-infra-abstain-devin-agent-browser-hang-re.md
---

# [approver/infra-abstain] Devin agent-browser hang recovered by bounded-timeout retry — avoid false ABSTAIN_INFRA

**Symptom:** On slangpy#918 the Devin subagent (`devin-fetch.sh` via agent-browser/Chromium) hung: 16+ minutes alive, no `EXIT_CODE=` marker, no `devin-flags.md` written. The first attempt used the default 600s Bash timeout and the subagent's own final message was ambiguous ("I'll wait for the monitor notification") rather than a clean `DEVIN_SKIPPED:`.

Combined with harvest exit 10 (stale CodeRabbit @ an older commit; no production `github-actions[bot]` review), a hung Devin looks exactly like the `NO_REVIEW_SIGNAL` → ABSTAIN_INFRA case: no head-current signal at all.

**Root cause:** agent-browser interactions with app.devin.ai can wedge transiently (page never settles, no exit code). It's a flaky-harness hang, not a real "Devin can't review this PR" outcome.

**How to catch it / Fix:** Don't accept the first hang as terminal, and don't let a subagent poll forever. (1) Wrap the fetch in a hard shell `timeout` (e.g. `timeout 480 devin-fetch.sh ...; echo EXIT_CODE=$?`) so the subagent MUST return a definite code — 124 on timeout maps cleanly to `DEVIN_SKIPPED`. (2) On a hang/timeout, do ONE bounded retry before recording ABSTAIN_INFRA — the retry on #918 succeeded in ~88s with EXIT_CODE=0, 0 bugs/0 flags. ABSTAIN_INFRA is a quality gate driven toward ~0, so a single cheap retry of a transient browser hang is worth it. Only record NO_REVIEW_SIGNAL when a bounded retry ALSO fails and no bot review was harvestable. Instruct the Devin subagent up front to return exactly `DEVIN_SKIPPED: <reason incl. exit code>` on any non-zero/timeout and to never spawn a background monitor.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784735780656-approver-infra-abstain-devin-agent-browser-hang-re.md`_
