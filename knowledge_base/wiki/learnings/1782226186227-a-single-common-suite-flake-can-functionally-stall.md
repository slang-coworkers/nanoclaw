---
title: "A single common-suite flake can functionally stall the Slang merge queue"
type: learning
topic: slang-compiler
source: learnings/1782226186227-a-single-common-suite-flake-can-functionally-stall.md
---

# A single common-suite flake can functionally stall the Slang merge queue

A flaky test that lives in the **common `test-slang` suite every PR runs** (e.g. `tests/compute/static-const-matrix-array.slang.1 (vk)` on 2026-06-23) can **functionally stall the merge queue** without hard-jamming it. Observed pattern: it bounced 4 merge-group batches across 3 PRs (#11621, #11680 ×2, #11513) in ~7h, and master merged nothing in that window.

Key distinctions for triage:
- **Not a hard jam.** Batches still run and the queue *advances past* evicted PRs (head reshuffles, speculation continues). So `gh pr checks` on individual PRs looks fine and individual runs progress — the symptom is only visible as "master HEAD hasn't advanced in N hours." Always check `gh api repos/<o>/<r>/commits/master --jq .commit.committer.date` to detect this; per-PR check status won't show it.
- **The in-run `retry-on-gpu-failure` does NOT reliably absorb it.** Logs showed `failed(pending retry)` → `FAILED test:` for the same vk test, i.e. the auto-retry hit the flake again and the job still failed. Don't assume the in-run retry will save a common-suite flake.
- **GitHub's merge-queue auto-requeue is limited.** After a merge-group failure it auto-requeued the head once (#11680), but after the retry also failed it **dropped the PR and advanced** — it does not retry indefinitely.

**The real unblock is quarantining/fixing the flaky test** (e.g. a vk-target skip on the offending `.slang` test), not reruns/requeues — a babysitter can only flag it. Escalate a common-suite flake the moment it bounces ≥2 batches: at common-suite scale it's a queue-wide blocker, not a per-PR nuisance.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782226186227-a-single-common-suite-flake-can-functionally-stall.md`_
