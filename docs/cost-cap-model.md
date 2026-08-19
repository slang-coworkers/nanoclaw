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
| **Tier 2 — $150 ceiling** | **HARD STOP** — quiesce before the next turn | **Escalate again — never auto-blocked**; operator adds USD via dashboard → Sessions |

- **Ceiling** = a runtime DB value (`ncl cost-cap set --ceiling`, see [below](#runtime-configuration--ncl-cost-cap-elevated-only)), falling back to `NANOCLAW_COST_T2_CEILING_USD` in `.env` (**$150**, reviewed monthly). It sits above even fixer's p95 ($142) → never bites legit work, and hard-stops runaway far below $1000.
- **Immortal is never silently blocked.** The orchestrator must stay alive; its bound is the human, who funds it via Continue. This is what flags (not kills) a $625-type main run.
- **Everything is reversible.** A stopped session resumes via dashboard **Continue** or `/clear`; a new session resets the counter.

## Windows
- **Non-immortal:** per-session lifetime — the counter is that session's total spend (survives container respawn; resets on new session / `/clear`).
- **Immortal:** per-UTC-day — resets daily so the orchestrator isn't bounded forever by one busy day.

## Where the numbers live
- **Per-group p90:** dashboard computes it over each group's real 7-day sessions → `data/cost-thresholds.json` (`perGroupP90Usd` map); host reads the group's value at spawn (`resolveCostCapT2Usd`).
- **Ceiling:** a runtime DB value (`ncl cost-cap set`, below), falling back to `.env` (`NANOCLAW_COST_T2_CEILING_USD`).
- **Live state:** `outbound.db` → `session_state.cost_cap` = `{ capUsd, spentUsd, status, immortal, window, decision }`; the dashboard **Sessions** tab renders spend / cap / status with Continue / Stop.

## Runtime configuration — `ncl cost-cap` (elevated only)
The ceiling and per-group caps no longer require a redeploy. An operator (or the `cli_scope=global` orchestrator) sets them at runtime; the host reads the DB (`cost_cap_policy` table) at the **next container spawn** and materializes the values into `container.json`. The env var stays a back-compat fallback — an install that sets nothing behaves exactly as before.

```
ncl cost-cap get                                   # effective fleet ceiling + every override
ncl cost-cap get --group slang-fixer               # a group's effective cap + ceiling
ncl cost-cap set --ceiling 150                      # fleet-wide Tier-2 ceiling
ncl cost-cap set --ceiling 300 --group slang-fixer  # per-group ceiling override
ncl cost-cap set --cap 60 --group slang-fixer       # per-group Tier-1 cap override (requires --group)
ncl cost-cap set --ceiling 0                         # explicitly disable the ceiling (beats the env var)
ncl cost-cap clear [--group <folder>]               # remove an override → restore env/thresholds fallback
```

- **Resolution precedence.** Cap: **DB per-group `cap_usd`** → `NANOCLAW_COST_T2_USD` env → `cost-thresholds.json` per-group p90 → fleet p90 → `$100` default (the auto-sourced tail is floored at `$10`; the two explicit operator overrides — DB and env — bypass the floor). Ceiling: **DB per-group `ceiling_usd`** → **DB fleet `ceiling_usd`** → `NANOCLAW_COST_T2_CEILING_USD` env → `0` (no ceiling). A stored DB value wins over the env var, **including `0`** (an explicit "no ceiling").
- **`--group <folder>`** is the group's workspace folder — the same key `cost-thresholds.json` uses (`perGroupP90Usd[folder]`), matching `resolveCostCapT2Usd` / `resolveCostCeilingT2Usd`.
- **Elevated only.** `cost-cap` is not in `GROUP_SCOPE_RESOURCES`, so the CLI guard denies it for any container under `cli_scope: 'group'` or `'disabled'`; only the host operator socket and a `cli_scope: 'global'` group can run it. A fleet-wide cost knob is not an ordinary coworker's to turn.
- **Effect timing.** `set` / `clear` write immediately but take effect at the next spawn (materialization is at spawn). To apply to a running session now, restart the group: `ncl groups restart --id <group-id>`.
- **Storage:** `cost_cap_policy` (central DB) — one row per scope keyed by `group_folder` (`''` = fleet). Accessors: `src/db/cost-cap-policy.ts`. Resolvers: `resolveCostCapT2Usd` / `resolveCostCeilingT2Usd` in `src/container-config.ts`.

## Floors & caveats
- **$10 minimum.** The auto-sourced cap is floored at **$10** — a brand-new group (no per-group and maybe no fleet p90 yet) still escalates somewhere sane, never at ~$0. An explicit `NANOCLAW_COST_T2_USD` override bypasses the floor.
- **The ceiling ends the session before its next turn** (turn-granularity, not mid-turn). Usage is accounted only when a turn completes, so the crossing is detected at turn end and the runner ends the session before the following turn — a single turn is bounded by the SDK's own limits, not the ceiling, so one pathological turn can overshoot $150. **Continue cannot buy past the ceiling** for non-immortal groups — only a new session / `/clear` resets spend below it.
- **Immortal Tier-1 is a loose visibility threshold, not a bound.** Its cap is the per-*session* p90 applied over a per-*day* window, so it's approximate — deliberately, since immortal is never hard-stopped. The human (funding via Continue) is the real bound.
- **Turning the ceiling off doesn't auto-resume** already-stopped sessions — they clear via Continue / `/clear`, consistent with the reversible model.

## One line
> Every session is capped at **its role's own recent p90** (escalate to a human there), under a hard **$150 ceiling** that stops runaway — except the orchestrator, which only ever escalates and waits for a human to fund it.
