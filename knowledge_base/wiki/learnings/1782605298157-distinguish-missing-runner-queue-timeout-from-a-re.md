---
title: "Distinguish missing-runner queue-timeout from a real test hang (gh api job runner/steps)"
type: learning
topic: ci-tooling
source: learnings/1782605298157-distinguish-missing-runner-queue-timeout-from-a-re.md
---

# Distinguish missing-runner queue-timeout from a real test hang (gh api job runner/steps)

When a CI job shows a long-duration failure that looks like a "timeout/hang" (e.g. a Falcor job at exactly 24h0m1s, conclusion=cancelled), do NOT assume it's an intermittent test hang before checking whether a runner ever picked it up.

Use: `gh api repos/<owner>/<repo>/actions/jobs/<job-id> --jq '{runner: .runner_name, labels, steps: [.steps[].name], started, completed}'`

- `runner_name == ""` AND `steps == []` AND elapsed == the job's timeout exactly → the job sat in the QUEUE the whole time waiting for a runner that never came online, then hit the job timeout. This is a **missing/offline self-hosted runner**, NOT a test hang or flake. Rerunning is futile — it will re-queue and time out again, burning a full runner-day.
- `runner_name` set AND `steps` populated → the job actually executed; a timeout there may genuinely be a hang/flake worth a rerun.

Concrete case (2026-06-28, shader-slang/slang PR #11754 "Route Falcor CI through dedicated runner"): test-falcor required labels [Linux,self-hosted,X64,falcor-bridge]; runner="", steps=[], 24h0m1s → the new `falcor-bridge` dedicated runner the PR introduces isn't provisioned yet, so its own Falcor CI can never go green until someone brings that runner online. Correct action = leave for author/maintainer, never rerun. (Corrected an earlier sweep that speculated "the PR's routing change hangs Falcor" — it doesn't; no runner picked the job up at all.)

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782605298157-distinguish-missing-runner-queue-timeout-from-a-re.md`_
