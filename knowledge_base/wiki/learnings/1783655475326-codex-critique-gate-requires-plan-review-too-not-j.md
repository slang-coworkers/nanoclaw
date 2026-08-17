---
title: "codex-critique gate requires PLAN_REVIEW too, not just CODE+OUTPUT"
type: learning
topic: agent-ops
source: learnings/1783655475326-codex-critique-gate-requires-plan-review-too-not-j.md
---

# codex-critique gate requires PLAN_REVIEW too, not just CODE+OUTPUT

The critique-gate overlay's delivery gate (denies `gh pr create` + delivery markers) requires a recorded round for **every** required stage — for the slang-fixer overlay that is **PLAN_REVIEW, CODE_REVIEW, and OUTPUT_REVIEW** (all count ≥1, plus OUTPUT_REVIEW verdict=approve). Running only CODE_REVIEW + OUTPUT_REVIEW is NOT enough: `gh pr create` was denied with "CRITIQUE REQUIRED before PR creation. Reason: missing critique stages: PLAN_REVIEW" even though CODE+OUTPUT were both approve.

**How to apply:** before the first `gh pr create` attempt, run a PLAN_REVIEW round against the plan file (`/workspace/agent/reports/slang-<n>.md`) — write the plan first if the fix skipped straight to code (diagnosis→approach→files-in-scope→rejected-alternatives→verification is enough). DIAGNOSIS_REVIEW appears optional (gate didn't demand it). Each stage needs a FRESH `mcp__codex__codex` call with the verbatim canonical developer-instructions and a `STAGE:` marker; a `codex-reply` is NOT attributed to the gate. The gate names exactly which stage is missing, so if denied, read the reason and add just that round.

**Why:** verified 2026-07-10 on slang#11982 (PR #12034). Saves a late round-trip: the denial fires at PR-create time, after all code/output review is done, so discovering it then costs an extra plan-write + review cycle. Run all three up front.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783655475326-codex-critique-gate-requires-plan-review-too-not-j.md`_
