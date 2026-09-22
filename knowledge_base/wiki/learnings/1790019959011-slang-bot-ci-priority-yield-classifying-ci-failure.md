---
title: "Slang bot CI priority-yield + classifying CI failures on a pure-Python PR"
type: learning
topic: slang-compiler
source: learnings/1790019959011-slang-bot-ci-priority-yield-classifying-ci-failure.md
---

# Slang bot CI priority-yield + classifying CI failures on a pure-Python PR

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789893649806-x43pcl
written_at: 2026-09-21T19:45:59.011Z
---

# Slang bot CI priority-yield + classifying CI failures on a pure-Python PR

From fixing shader-slang/slang#13184 (PR #13185, a pure-Python `extras/` release-verifier fix).

**1. `nv-slang-bot[bot]` `workflow_dispatch` CI runs priority-yield — don't manually re-dispatch to "force" a matrix.** On a DRAFT PR, ci.yml skips the `pull_request` matrix (filter job guards `github.event.pull_request.draft != true`). Dispatching ci.yml via `workflow_dispatch` as the bot bypasses the draft-skip, BUT the run immediately yields: `wait-for-human-priority` + `check-ci` show `failure` (the intended throttle), the whole build/test matrix is `skipped`, and it parks `waiting` on `falcor-build-approval-gate`. Facts (verified against extras/ci/*.py + ci-retry-yielded-bot.yml): `retry-yielded-bot-ci` only re-runs *completed* runs (a `waiting` run suppresses retry until the Falcor gate resolves + it completes), and the aging fallback is ~12h from dispatch and only relaxes a *subsequent* rerun's priority decision — it does not push the waiting run forward. So a fresh bot dispatch just re-yields/churns. The reliable way to get a real un-yielded matrix is a **human marking the PR ready** (`ready_for_review` → normal `pull_request` run). Marking ready bypasses the priority-throttle but NOT the Falcor environment approval (separate). Marking ready is operator-gated for us anyway (drafts-only), so hold and let the human shepherd do it.

**2. A pure-Python `extras/` change cannot break C++ build/GPU-test jobs — use that to classify CI failures fast.** When the failing jobs are C++ builds (linux/macos), C++ static-unit-tests, or GPU tests, but the `Check Python Scripts (Core Python Only)` + `Check Formatting` legs PASS, the failure is NOT your Python change (it's not compiled into slangc/slang-test). It's either infra/flaky or a master breakage inherited via a `BEHIND` branch. Confirm via `--log-failed`: HTTP 504 downloads (sccache/OptiX tarballs from github.com), runner OOM, timeouts, cancellations = **infra/flaky** → it auto-retries; do nothing. Genuine compile/link errors or unit-test asserts in C++ source = **master breakage** → not your fault, wait for master fix / rebase when master is green. Don't rebase a `BEHIND` branch mid-CI-run — it cancels the running matrix and can dismiss a fresh maintainer approval.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790019959011-slang-bot-ci-priority-yield-classifying-ci-failure.md`_
