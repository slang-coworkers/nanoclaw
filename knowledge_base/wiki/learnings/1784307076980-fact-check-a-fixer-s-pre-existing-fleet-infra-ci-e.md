---
title: "Fact-check a fixer's 'pre-existing fleet infra' CI escalation against sibling PRs before escalating to operator"
type: learning
topic: agent-ops
source: learnings/1784307076980-fact-check-a-fixer-s-pre-existing-fleet-infra-ci-e.md
---

# Fact-check a fixer's "pre-existing fleet infra" CI escalation against sibling PRs before escalating to operator

When a fixer escalates a CI failure as "pre-existing fleet infrastructure issue, not my code" (and proposes waiting for some infra branch/fix), VERIFY before relaying it up or escalating to the operator — the framing can be wrong and the check is cheap.

On slangpy PR#1053 the fixer attributed a 6h GPU-test-lane hang to a fleet-wide "CUDA-OOM cascade from `pytest --maxprocesses=4`, needs the unmerged `ci/cap-gpu-test-workers` branch." Fact-check disproved it: (a) 11 other contemporaneous open PRs ran the IDENTICAL 12-job CI matrix on the same `main` `--maxprocesses=4` and passed in ~12–17min, zero hangs → not fleet-wide; (b) the proposed cap branch was behind-main-19/ahead-1 with NO open PR (stale/abandoned) → "wait for its merge" was a dead end; (c) the PR branch was 19 commits behind main while the passing PRs were on current main → stale-base was the leading hypothesis; (d) the macOS-aarch64 lane (Metal, no CUDA) was among those hanging → CUDA-OOM story didn't fit.

**How to fact-check a "fleet infra" claim:**
- Pull ~10 other recent open PRs, get each HEAD sha, list its `ci` run's jobs, compute per-job durations. If siblings pass the same matrix fast, it's NOT fleet-wide — it's the branch.
- Check any "waiting on infra branch X" claim: does X exist, is it ahead of main, does it have an open PR? `compare/main...X` + `pulls?head=owner:X`. A stale/PR-less branch is not a plan.
- Cheapest discriminator for stale-base-vs-real-infra: have the fixer rebase onto current main and re-run. If it still fails post-rebase (0-behind), stale-base is ruled out and escalation is justified. On #1053 it DID still hang post-rebase → genuinely isolated to the branch's test file wedging the GPU suite, undiagnosable without runner access → legitimately escalated + handed to the maintainer with GPU-runner access.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1784307076980-fact-check-a-fixer-s-pre-existing-fleet-infra-ci-e.md`_
