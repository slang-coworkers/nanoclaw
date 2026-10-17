---
type: chain
title: nanoclaw PR — classify 30-day expired falcor gates as blocked (gate_expired)
description: The babysitter's sweep-gate fix. It is ready on a local branch and waiting on the operator's OK to open the PR against slang-coworkers/nanoclaw nv-slang; the 10-16 approval prompt timed out. A gate 0e prompt update follows the merge.
tags: [nanoclaw, ci-babysitter, falcor-gate, pending-operator]
---

# Expired falcor gate → `gate_expired` (nanoclaw nv-slang PR)

- **Why:** GitHub fails a job waiting on environment approval after 30 days ([docs](https://docs.github.com/actions/deployment/about-deployments/deploying-with-github-actions)). The falcor gate uses `environment: falcor-ci` (slang `ci.yml:455`), so an unapproved gate ends as `failure` after exactly 30 days. #13127's ran 09-16T13:29:07Z → 10-16T13:29:08Z. The sweep woke the babysitter for each of these as an actionable failure.
- **Where the code lives:** since nanoclaw #2049 (10-15) the babysitter's task row is a stub that runs `/app/skills/slang-ci-babysitter/scripts/sweep-gate.mjs`, which is byte-identical to `nv-slang`. The file is read-only in its container, so changes go in as a PR.
- **Patch:** from the babysitter, `/workspace/inbox/a2a-1792161218541-okpmof/sweep-gate-gate-expired-2026-10-16.patch` (sha256 `ae7363dade977c74…`, 8174 B). I checked: it applies to origin/nv-slang `7908637d7`, `node --check` passes, and `node --test` gives 21/21 (17 before). I read the diff: `isExpiredGateRun` (30d duration), the REST path also requires `steps: []`, the GraphQL path uses duration only, and `cancelled → gate_timeout` is unchanged. The babysitter's live dry-run showed that only #13127 changes class.
- **Local branch:** `fix/nv-slang/babysitter-gate-expired`, commit `f84c580d1`, worktree `/tmp/nc-gate` (lost on a container restart; recreate it from the patch). **Not pushed.**
- **10-16 14:45Z:** the operator approval prompt (`ask_user_question`, 600 s) timed out, so the PR is held. The repo's PR-hygiene rule needs the operator's OK.
- **After merge:** replace gate 0e in the babysitter's wake prompt with its proposed text (in msg 2706, the inbound of 10-16 14:33Z). Only after the merge. Its open question: the drift check may now be vestigial, because it hashes a memory file nobody should edit. Keep or drop it is the operator's call.
- **Re-check:** one-shot `nanoclaw-gate-expired-pr-30c5` at 10-17 09:00Z. If the operator answered, it acts on that answer; if not, it names the decision once.
