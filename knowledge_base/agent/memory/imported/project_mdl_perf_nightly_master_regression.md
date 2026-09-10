---
name: project_mdl_perf_nightly_master_regression
description: Nightly MDL Perf Test — confirmed 5-day/4-SHA master regression (07-11→07-16); bisect window 4d91d47b→8f0c3515; routed to ci-babysitter
metadata: 
  node_type: memory
  type: project
  originSessionId: 5bec4191-e017-44da-b211-e48a8839d909
---

**shader-slang/slang — Nightly MDL Perf Test** failing on `master` (`event=schedule branch=master`). Surfaced by slang-discord-support heartbeat 2026-07-16 06:22Z (msg 38898).

- **Escalation:** was a "2-day same-SHA watch" at the prior heartbeat; now a **confirmed 5-day streak across 4 distinct SHAs** (rules out a transient). Last green **07-11 `4d91d47b`**; then red on `8f0c3515`×2 → `a9c6ff78` → `c5d4d76e` → `6c837d31`. Latest failing run **29475220973** (05:55Z, sha `6c837d31`).
- **Bisect window:** `4d91d47b` (last green) → `8f0c3515` (first red).
- **Scope:** nightly-only. Daytime PR + merge-queue CI idle/green at report time — NOT blocking merges. Distinct from the ~11-day **Nightly Slang Test** streak (already Dev-Channel Action Item #1; do not duplicate).
- **Bot scope:** slang-discord-support is read-only + summon-reply only — it can surface but not own/escalate. It recommended raising MDL Perf on the Slang Dev Channel.
- **2026-07-16 06:30 — routed to slang-ci-babysitter** (thread `slang-mdl-perf-nightly-streak`) to classify flake-vs-real + culprit ID. Read-only, no fix.
- **2026-07-17 06:25 — STILL RED, advanced to 6-day/5-SHA (discord-support heartbeat).** Latest red run 29558634900, sha `5c30d437` (added past `6c837d31`). Bisect window unchanged (`4d91d47b`→`8f0c3515`). Persistence strengthens "real, not transient." No re-nag to operator — outreach decision already pending with them; a one-night increment isn't a new signal.
- **2026-07-16 06:47 — CLASSIFIED REAL (ci-babysitter msg 38900).** It's a **front-end compile-time perf-gate trip**, NOT a crash / infra / flake / the MDL corpus. Build + MDL sweep + publish green on every red run; only `Check trend (fail on regression)` (`tools/compile-perf/trend.py`, gate: ratio ≥1.25 AND Δ ≥2.0ms) fails. `mdl_dxr` corpus compileInner stable (1137→1153→1109ms, never flagged); flags are on front-end/SemanticChecking micro-benchmarks (`interface_depth`, `implicit_conversion`).
  - **Culprit (inference, NOT a run bisect):** **PR #11615 "Fix generic interface witness lowering"** (csyonghe, merged 07-11 16:04Z; +3493/−1657, 40 files — whole semantic checker/AST/lowering). **Sole commit** in the `4d91d47b`(last-green)→`8f0c3515`(first-red) window; regressed workloads match its footprint; still live on master HEAD; no existing issue.
  - **⚠️ Caveats (babysitter, honest):** (1) regression is **small & near-gate** — same-SHA dispatch `694022a1` went both green AND red on 07-15, straddling the 1.25 threshold; the 5-day/4-SHA streak is the real signal, not any single run. (2) 07-16 headline **1.40–1.48x on `interface_depth` is INFLATED** — that workload is NEW (added 07-15 by #12086 reporting-redesign, which also shrank the baseline 7pt→3pt); stable pre-existing workloads show **~+3–16ms / 1.26–1.30x**. Cleanest evidence = 07-12 first-red flagged vs the pure green-era 7-point baseline. (3) first two reds' `UnicodeEncodeError` is downstream of detection, not a masking artifact.
  - Babysitter saved a durable learning + local trace `memory/mdl-perf-nightly-streak-2026-07-16.md` (offered to attach; not requested).
- **2026-07-16 06:47 — surfaced to operator (dashboard).** Held the public-GitHub attribution: naming csyonghe's merged PR is outward-facing + the attribution is a window-inference not a proven bisect + magnitude is soft/measurement-inflated → operator decides the outreach. Classification + trace durable regardless. Await operator call (raise #11615 w/ csyonghe / Dev Channel / hold).
- **Watch (minor):** merge-queue ~39% fail share (12/31) noted same heartbeat — not yet escalated.

Standing authority to act on CI-red: [[feedback_supervisor_autonomous_authority]]. Bot-PR manual-dispatch reds are cosmetic ([[project_bot_pr_priority_yield_red_run]]) but these are `event=schedule` real nightly runs, not that class.
