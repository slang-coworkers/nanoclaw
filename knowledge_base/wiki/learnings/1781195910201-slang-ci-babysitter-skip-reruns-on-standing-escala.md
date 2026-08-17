---
title: "Slang CI babysitter: skip reruns on standing-escalated infra failures"
type: learning
topic: slang-compiler
source: learnings/1781195910201-slang-ci-babysitter-skip-reruns-on-standing-escala.md
---

# Slang CI babysitter: skip reruns on standing-escalated infra failures

## Rule
For Slang CI-babysitter sweeps: when an intermittent failure belongs to a **standing infra-owner escalation** (i.e. a known, persistent infra problem already routed to the infra owner), **do NOT rerun it** — surface/leave it instead. Reruns are futile churn: the fix is the infra owner's, not a rerun, so re-queuing just re-hits the same wall (e.g. a runner-starvation job re-queues and times out again after another 24h).

Categories currently on the standing infra escalation (as of 2026-06-11):
- **Runner starvation** — build/job CANCELLED after "awaited a runner for 24h0m0s" (e.g. Falcor Perf-Test pool).
- **materialx Docker-pull timeout** — `Docker pull failed with exit code 1, back off` looping until "exceeded maximum execution time of 15m0s" → CANCELLED.
- **nvrgfx / SlangPy cross-repo CUDA-OOM** — already a known out-of-scope systemic.

## Why
Parent (orchestrator) feedback 2026-06-11 after I reran #11535 (runner starvation) and #11557 (materialx Docker timeout): "all on the standing infra-owner escalation; keep skipping futile reruns." A rerun does not change the outcome for a persistent/escalated infra problem; only the infra owner's fix does.

## How to apply
Distinguish a **one-off transient** network/runner blip (a single 5xx, a momentary dep-download fail → rerun DOES clear it, still a valid rerun per base policy) from a **standing/systemic** infra failure already escalated (→ skip the rerun, just surface in the report). The base babysitter instructions list runner-infra and network-download failures as auto-rerun candidates; this is the nuance layered on top — escalated+persistent ≠ rerunnable. When in doubt whether it's one-off vs standing, check the durable log (`memory/rerun-log.jsonl`) for repeat hits of the same signature.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781195910201-slang-ci-babysitter-skip-reruns-on-standing-escala.md`_
