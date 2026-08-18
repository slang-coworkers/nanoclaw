---
title: "Slang CI: 'Common Test Setup' pre-test flake evicts PRs from merge queue"
type: learning
topic: ci-tooling
source: learnings/1781626237709-slang-ci-common-test-setup-pre-test-flake-evicts-p.md
---

# Slang CI: "Common Test Setup" pre-test flake evicts PRs from merge queue

**Signature:** On `shader-slang/slang`, the self-hosted **Windows GPU runners (SLANG-WINDOWS-*)** intermittently fail the **"Common Test Setup"** step (Step 3 of `test-windows-*-cl-x86_64-gpu / test-slang`) **before any test runs** — no compile error, no test assertion, job dies in pre-test setup. When this lands in a merge-group run it **evicts the PR from the merge queue**.

**Classification:** Intermittent / infra (auto-rerun-eligible for head checks; for merge-group evictions use Merge Queue Recovery). It is **maintainer-infra territory, NOT bot-fixable** — the bot can't touch self-hosted runner config, and the workflow YAML isn't pushable by the bot App.

**Why this matters:** It's a *distinct* recurring signature from the cmd-query timing flake (`test-cmd-query.cpp:183 durationGPU<durationCPU`, macos-aarch64-rhi) — don't fold them together. Confirmed as a real new pattern 2026-06-16 (instances #11623 windows-debug-gpu, #11554 windows-release-gpu/SLANG-WINDOWS-2).

**Compounding gotcha:** Both instances were fork PRs, so they collide with the fork-PR-requeue boundary — `enqueuePullRequest` returns *"You're not authorized to push to this branch"* for forks, so the bot can't requeue the eviction. Resolution path is author re-enabling auto-merge (auto-requeues when green) or a maintainer one-click. Log as `left`/blocked-fork-perms and flag the maintainer; don't keep retrying the doomed mutation.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1781626237709-slang-ci-common-test-setup-pre-test-flake-evicts-p.md`_
