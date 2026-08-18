# NanoClaw Cost Cap — Model

## Why
A small tail of runaway sessions drives most spend (≈4% of sessions ≈ 30% of cost — the driver is large context re-read on every turn). The cap catches a session spending abnormally **for its role**, escalates it to a human, and hard-stops non-critical ones — without throttling normal work.

## The instrument: per-group p90, not one fleet number
Cost is role-dependent, so a single number can't fit all. Each group's cap = **its own 7-day p90** of real per-session spend, recomputed by the dashboard and read fresh at every spawn (self-tuning; no hand-tuning):

| Group | 7-day p90 (its Tier-1 cap) |
|---|---|
| slang-fixer | ~$91 |
| slang-triager | ~$45 |
| slang-pr-approver | ~$34 |
| slang-reviewer | ~$12 |
| main (orchestrator) | ~$10 |

> A *fleet* p90 was $18.57 — **below slang-fixer's median ($24)**, so it would escalate half of all fixer sessions. Per-group fixes that.

## Two tiers

| Session spend reaches… | Non-immortal (fixer / triager / reviewer / approver) | Immortal (main / admin) |
|---|---|---|
| **Tier 1 — its group p90** | **Escalate** → human picks **Continue** (+1 allotment) or **Stop** | **Escalate for visibility** (Continue-only) |
| **Tier 2 — $150 ceiling** | **HARD STOP** — quiesce, no more tokens | **Escalate again — never auto-blocked**; operator adds USD via dashboard → Sessions |

- **Ceiling** = `NANOCLAW_COST_T2_CEILING_USD` in `.env` (**$150**, fixed until reviewed monthly). It sits above even fixer's p95 ($142) → never bites legit work, and hard-stops runaway far below $1000.
- **Immortal is never silently blocked.** The orchestrator must stay alive; its bound is the human, who funds it via Continue. This is what flags (not kills) a $625-type main run.
- **Everything is reversible.** A stopped session resumes via dashboard **Continue** or `/clear`; a new session resets the counter.

## Windows
- **Non-immortal:** per-session lifetime — the counter is that session's total spend (survives container respawn; resets on new session / `/clear`).
- **Immortal:** per-UTC-day — resets daily so the orchestrator isn't bounded forever by one busy day.

## Where the numbers live
- **Per-group p90:** dashboard computes it over each group's real 7-day sessions → `data/cost-thresholds.json` (`perGroupP90Usd` map); host reads the group's value at spawn (`resolveCostCapT2Usd`).
- **Ceiling:** operator-set in `.env` (`NANOCLAW_COST_T2_CEILING_USD`).
- **Live state:** `outbound.db` → `session_state.cost_cap` = `{ capUsd, spentUsd, status, immortal, window, decision }`; the dashboard **Sessions** tab renders spend / cap / status with Continue / Stop.

## One line
> Every session is capped at **its role's own recent p90** (escalate to a human there), under a hard **$150 ceiling** that stops runaway — except the orchestrator, which only ever escalates and waits for a human to fund it.
