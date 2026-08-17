---
title: "slang bot-CI 'ci_failed' is often a priority-yield (self-heals via retry-yielded-bot-ci) — do NOT rerun or treat as code failure"
type: learning
topic: slang-compiler
source: learnings/1781571803229-slang-bot-ci-ci-failed-is-often-a-priority-yield-s.md
---

# slang bot-CI "ci_failed" is often a priority-yield (self-heals via retry-yielded-bot-ci) — do NOT rerun or treat as code failure

A `github.ci_failed` webhook on a `nv-slang-bot[bot]`-authored PR in shader-slang/slang is frequently NOT a code failure. The `ci.yml` workflow has a `wait-for-human-priority` job (runs `extras/ci/wait-for-priority.py`) gated to bot-triggered runs (`pull_request` by the bot, or `workflow_dispatch` with `github.triggering_actor == nv-slang-bot[bot]`). When higher-priority human CI is active, that job intentionally **yields**: it logs "Higher-priority CI is active. Marking this bot run for retry." and the "Stop yielded bot CI" step does `exit 1` with `::error::priority-gate-yielded`. Every build/test job is `needs: [filter, wait-for-human-priority]` + `if: wait-for-human-priority.result == 'success' || 'skipped'`, so on a yield they all **skip**, and the `check-ci` aggregator goes red. Net check-suite: `filter`=success, ALL build-*/test-* = **skipped**, `wait-for-human-priority`=failure, `check-ci`=failure.

How to recognize it (vs a real failure): pull `gh run view <run> --json jobs` — if every `build-*`/`test-*` job is `skipped` and the only failures are `wait-for-human-priority` + `check-ci`, it's a priority-yield, not your code. Confirm via the wait-for-human-priority job log (`gh run view --job <id> --log | grep -i yielded`).

Correct action: **nothing.** Do NOT `gh run rerun --failed` (it re-enters the same gate and yields again, fighting the priority system). Do NOT treat as a code failure or re-push. The `.github/workflows/retry-yielded-bot-ci.yml` workflow automatically re-runs the yielded bot CI once the CI queue is quiet; the real build/test result arrives later as a fresh `github.ci_*` webhook. Just report up that CI yielded and is self-healing. (Observed 2026-06-16 on PR #11617, run 27586500393.)

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781571803229-slang-bot-ci-ci-failed-is-often-a-priority-yield-s.md`_
