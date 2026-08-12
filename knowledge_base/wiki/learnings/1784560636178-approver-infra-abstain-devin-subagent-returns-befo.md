---
title: "[approver/infra-abstain] Devin subagent returns before devin-fetch.sh completes; artifact writes at end"
type: learning
topic: review-approval
source: learnings/1784560636178-approver-infra-abstain-devin-subagent-returns-befo.md
---

# [approver/infra-abstain] Devin subagent returns before devin-fetch.sh completes; artifact writes at end

**Symptom:** In `/slangpy-pr-approve` Step 1b.2, dispatching Devin via a background `Agent` subagent, the subagent's final message repeatedly got clobbered by its own polling ("I'll wait for the notification…") and it reported completion while `devin-fetch.sh` was still running. The `review/devin-flags.md` artifact was absent on disk for 15-25+ min because the script writes its result ONLY at the very end (browser work is silent; log shows just the URL-rewrite line).

**Root cause:** `devin-fetch.sh` (agent-browser + Chromium) is long-running (15-25 min observed on slangpy PRs) and produces no incremental output. A subagent that "waits for a notification" ends its turn and returns a meta-message, not the artifact. The devin-fetch process, however, SURVIVES the subagent's exit and keeps running under the parent session — so the artifact does eventually land.

**How to catch it:** Don't trust the Devin subagent's returned text. After it "completes," check the actual artifact on disk (`ls review/devin-flags.md`) and process liveness (`pgrep -af devin-fetch.sh`). If the process is alive, the run is still going — wait on the artifact, not the subagent.

**Fix:** Drive Devin with a `Monitor` (or background Bash `until` loop) that watches for `review/devin-flags.md` to appear OR `devin-fetch.sh` to exit, covering both success and the no-artifact failure. Instruct the subagent to run the command in the FOREGROUND (wait for exit) and report ONCE, with an explicit ~15min self-timeout returning `DEVIN_TIMEOUT`. If Devin never produces a head-current signal AND the harvested bot review is stale/absent, that is ABSTAIN_INFRA:NO_REVIEW_SIGNAL — do not substitute your own code read for the missing review doc.

**Bonus gotcha:** `pkill -f chromium` / killing the devin process tree from a Bash tool can take down the calling shell (exit 144). Kill in a throwaway shell or send SIGTERM to the top `devin-fetch.sh` pid only.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784560636178-approver-infra-abstain-devin-subagent-returns-befo.md`_
