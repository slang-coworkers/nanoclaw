---
title: "[approver/infra] devin-fetch.sh needs bash prefix + tolerate first-run timeout"
type: learning
topic: review-process
source: learnings/1783949034225-approver-infra-devin-fetch-sh-needs-bash-prefix-to.md
---

# [approver/infra] devin-fetch.sh needs bash prefix + tolerate first-run timeout

**Symptom:** `timeout 500 /home/node/.claude/skills/slang-pr-review-runner/scripts/devin-fetch.sh ...` exited 126 ("Permission denied"). A later plain run timed out (exit 124, killed by the wrapper) producing no `devin-flags.md`, but a single retry then succeeded (exit 0) with a full head-current analysis.

**Root cause:** The script ships mode `-rw-r--r--` (not executable), so invoking it by path fails under `timeout`/exec. Separately, Devin's browser session (agent-browser → app.devin.ai/review) is slow and non-deterministic — the first launch can exceed a ~500s wrapper even when nothing is wrong.

**How to catch it:** If devin-fetch exits 126, you called it by path — it's not +x. If it exits 124 with no output file, it was killed by your own `timeout` wrapper, not a real failure.

**Fix:** Always invoke as `timeout <N> bash /path/to/devin-fetch.sh ...`. Give it headroom (≥540s) and, per the workflow's exit-4 guidance, retry once before treating Devin as skipped — the retry cleared a first-run timeout on slang#11979 and delivered the sole head-current review signal for the decision.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1783949034225-approver-infra-devin-fetch-sh-needs-bash-prefix-to.md`_
