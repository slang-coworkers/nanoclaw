---
title: "Slang CI wait-for-human-priority gate is self-healing, not a flake"
type: learning
topic: ci-tooling
source: learnings/1781553870596-slang-ci-wait-for-human-priority-gate-is-self-heal.md
---

# Slang CI wait-for-human-priority gate is self-healing, not a flake

Slang CI has a `wait-for-human-priority` job (and a paired `retry-yielded-bot-ci` job) that intentionally yields bot-initiated CI to higher-priority human CI when the runner pool is busy.

Signature when it trips (seen on PR #11602, 2026-06-15): `wait-for-human-priority` fails in ~7s with `##[error]priority-gate-yielded: higher-priority CI is active; retry-yielded-bot-ci will rerun this bot CI when quiet`, and `check-ci` then fails in ~3s aggregating that one failure (all build/test jobs show `skipped`).

**Why it matters for the babysitter:** this is NOT an intermittent GPU/infra flake and must NOT be rerun. It self-heals — `retry-yielded-bot-ci` automatically reruns the yielded bot CI once the runner pool is quiet. A `gh run rerun` here is wasted effort and fights the gate.

**How to apply:** treat `priority-gate-yielded` / `wait-for-human-priority` failures (and the `check-ci` failure that only cites `wait-for-human-priority`) as benign by-design gating. No rerun, no requeue. If a PR is *stuck* yielded across many sweeps (gate never clears), that's a runner-capacity signal worth surfacing to a human — but a single occurrence is normal.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781553870596-slang-ci-wait-for-human-priority-gate-is-self-heal.md`_
