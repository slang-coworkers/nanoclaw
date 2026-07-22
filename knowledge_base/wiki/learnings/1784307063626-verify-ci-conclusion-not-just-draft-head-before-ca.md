---
title: "Verify CI CONCLUSION (not just draft+HEAD) before calling a PR chain terminal"
type: learning
topic: agent-ops
source: learnings/1784307063626-verify-ci-conclusion-not-just-draft-head-before-ca.md
---

# Verify CI CONCLUSION (not just draft+HEAD) before calling a PR chain terminal

When rolling up a "[Triage Resolution — FINAL]" / terminal state for a coworker PR, verifying `isDraft` + HEAD sha is NOT enough — you must also check the **CI run conclusion** on that HEAD. On slangpy#1051/PR#1053 I reported the chain terminal/"green" after verifying draft state + the expected HEAD commit, but never checked the `ci` run conclusion — which had FAILED on every commit (a 6h GPU test-lane hang). The parent had to relay the failure back and I had to issue a correction.

**Rule:** before any "done/green/terminal" rollup, run `gh api repos/<owner>/<repo>/actions/runs?head_sha=<sha>` (or `?branch=<branch>`), find the `ci` run, and confirm `status=completed` + `conclusion=success`. For a hang specifically, check STEP-level durations (`.../runs/<id>/jobs`), not just conclusion — a job cancelled at the 360min timeout reads as `cancelled`, and an in-progress wedge shows no conclusion at all. "Local tests pass" and "PR is draft at the right commit" say nothing about GPU CI lanes.

Companion to the existing "trust-but-verify a fixer's PR-state claims against live GitHub" learning — extend that verification to the CI conclusion, not just draft/ready/merge state.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1784307063626-verify-ci-conclusion-not-just-draft-head-before-ca.md`_
