# Outcome coverage of the re-baselined 61 rows

Source: `rebaseline/rows-final.json` (dispositions + outcomes), rendered alongside `rebaseline/gap-matrix-rebaselined.md`. Rows are listed in matrix order. A `MERGE→<id>` row carries its outcome as a criterion inside the target row's ADR, so the work behind it is the target's disposition (given in brackets).

## O1 — Slang GitHub issues are triaged, fixed (PR), reviewed and maintained by the coworker team running on Hermes, on schedule and on webhook events.

14 rows (BUILD 1, CONFIGURE 7, ADOPT 3, MERGE 3).

RT-F03 (CONFIGURE), ISO-F11 (ADOPT), GOV-F25 (BUILD), SCHED-F32 (ADOPT), SCHED-F33 (CONFIGURE), SCHED-F34 (CONFIGURE), LOOP-F36 (MERGE→LOOP-F35 [BUILD]), LOOP-F39 (CONFIGURE), LOOP-F40 (CONFIGURE), MEM-F43 (CONFIGURE), OBS-F48 (MERGE→GOV-F25 [BUILD]), CH-F49 (ADOPT), CH-F52 (CONFIGURE), SELF-F56 (MERGE→LOOP-F35 [BUILD])

## O2 — Coworker roles are defined once (spines, skills, workflows, gates) and rendered into Hermes profiles so they appear in the Bots list.

10 rows (BUILD 1, CONFIGURE 5, ADOPT 1, MERGE 3).

RT-F01 (CONFIGURE), ISO-F16 (CONFIGURE), LOOP-F35 (BUILD), LOOP-F36 (MERGE→LOOP-F35 [BUILD]), MEM-F41 (CONFIGURE), SELF-F54 (MERGE→LOOP-F35 [BUILD]), SELF-F55 (CONFIGURE), SELF-F56 (MERGE→LOOP-F35 [BUILD]), SELF-F57 (ADOPT), SELF-F57.b (CONFIGURE)

## O3 — Bots collaborate inside one gateway (rooms, kanban) under explicit wiring, with an elevated orchestrator; wiring violations are refused, not merely discouraged.

17 rows (BUILD 3, CONFIGURE 4, ADOPT 5, MERGE 5).

RT-F01 (CONFIGURE), RT-F02 (CONFIGURE), RT-F03 (CONFIGURE), RT-F05 (ADOPT), RT-F08 (ADOPT), RT-F09 (ADOPT), A2A-F18 (MERGE→LOOP-F37 [BUILD]), A2A-F19 (MERGE→LOOP-F37 [BUILD]), A2A-F20 (ADOPT), GOV-F22 (MERGE→LOOP-F37 [BUILD]), GOV-F25 (BUILD), GOV-F26 (MERGE→LOOP-F37 [BUILD]), LOOP-F35 (BUILD), LOOP-F37 (BUILD), LOOP-F39 (CONFIGURE), CH-F51 (MERGE→LOOP-F37 [BUILD]), OPS-F58 (ADOPT)

## O4 — Every coworker's tools run in its own sandbox; credentials are injected per profile via OneCLI; no raw secrets anywhere.

12 rows (BUILD 2, CONFIGURE 5, ADOPT 1, MERGE 4).

RT-F09 (ADOPT), ISO-F10 (MERGE→LOOP-F37 [BUILD]), ISO-F13 (CONFIGURE), ISO-F14 (CONFIGURE), ISO-F15 (CONFIGURE), ISO-F16 (CONFIGURE), GOV-F26 (MERGE→LOOP-F37 [BUILD]), GOV-F27 (CONFIGURE), CRED-F28 (BUILD), LOOP-F35 (BUILD), CH-F51 (MERGE→LOOP-F37 [BUILD]), SELF-F54 (MERGE→LOOP-F35 [BUILD])

## O5 — Quality gates (critique, plan gate, PR review and the approval-decision ledger) hold before anything reaches GitHub.

10 rows (BUILD 2, CONFIGURE 3, ADOPT 2, MERGE 3).

RT-F07 (ADOPT), ISO-F13 (CONFIGURE), A2A-F19 (MERGE→LOOP-F37 [BUILD]), GOV-F22 (MERGE→LOOP-F37 [BUILD]), GOV-F23 (CONFIGURE), GOV-F24 (BUILD), LOOP-F37 (BUILD), LOOP-F38 (MERGE→LOOP-F37 [BUILD]), LOOP-F40 (CONFIGURE), CH-F50 (ADOPT)

## O6 — Cost is bounded per session and per day, with human decision cards when a ceiling is hit.

7 rows (BUILD 2, CONFIGURE 2, ADOPT 2, MERGE 1).

ISO-F12 (ADOPT), ISO-F16 (CONFIGURE), A2A-F21 (CONFIGURE), COST-F29 (BUILD), COST-F30 (BUILD), COST-F31 (ADOPT), OBS-F48 (MERGE→GOV-F25 [BUILD])

## O7 — Humans see and control the fleet from one panel: sessions, bots, rooms, cron, approvals, cost.

13 rows (BUILD 1, CONFIGURE 5, ADOPT 6, MERGE 1).

RT-F01 (CONFIGURE), RT-F02 (CONFIGURE), RT-F05 (ADOPT), RT-F07 (ADOPT), GOV-F23 (CONFIGURE), GOV-F26 (MERGE→LOOP-F37 [BUILD]), COST-F30 (BUILD), SCHED-F34 (CONFIGURE), OBS-F45 (ADOPT), CH-F49 (ADOPT), CH-F50 (ADOPT), OPS-F58 (ADOPT), OPS-F58.a (CONFIGURE)

## O8 — Observability and durability: transcripts and traces, fleet metrics, restart recovery, learnings carried forward.

23 rows (BUILD 1, CONFIGURE 10, ADOPT 10, MERGE 2).

RT-F08 (ADOPT), ISO-F10 (MERGE→LOOP-F37 [BUILD]), ISO-F11 (ADOPT), ISO-F12 (ADOPT), ISO-F17 (ADOPT), A2A-F20 (ADOPT), A2A-F21 (CONFIGURE), GOV-F24 (BUILD), COST-F31 (ADOPT), SCHED-F32 (ADOPT), SCHED-F33 (CONFIGURE), LOOP-F39 (CONFIGURE), MEM-F41 (CONFIGURE), MEM-F42 (CONFIGURE), MEM-F43 (CONFIGURE), MEM-F44 (CONFIGURE), OBS-F45 (ADOPT), OBS-F46 (CONFIGURE), OBS-F47 (ADOPT), OBS-F48 (MERGE→GOV-F25 [BUILD]), SELF-F57 (ADOPT), SELF-F57.b (CONFIGURE), OPS-F58.a (CONFIGURE)

## Carrying no outcome

RT-F04 (DEFER), RT-F06 (DEFER), CH-F53 (DEFER), SELF-F57.a (DEFER) — all DEFER, recorded with a reason and dispatched to nothing.

## Thin outcomes

Test applied: an outcome is thin if no `BUILD` row — and no `CONFIGURE` row, and no `MERGE` into a BUILD row — stands behind a capability Hermes actually lacks, i.e. if everything under it is a doc page over a native feature.

**No outcome is thin under that test.** Each of O1-O8 has at least one row that closes a real gap:

- O1 — GOV-F25 (BUILD `nv-artifact`: durable `<repo>#<pr>` ownership, first-claim-wins) plus CH-F52 (CONFIGURE: the webhook routes on the default profile).
- O2 — LOOP-F35 (BUILD `nv-coworker-compose`: repo/type manifest → rendered profile distributions → Bots list; SELF-F54/F56/LOOP-F36 merge into it) plus SELF-F55 (CONFIGURE: the distribution layout).
- O3 — LOOP-F37 (BUILD `nv-fleet-gates`: the single `pre_tool_call` veto that makes a wiring violation a refusal; A2A-F18/F19, CH-F51, GOV-F22, GOV-F26, ISO-F10 merge into it) and GOV-F25.
- O4 — CRED-F28 (BUILD `podman-onecli`: per-profile OneCLI identity injection) plus ISO-F13/F14/F15/F16 (CONFIGURE: the per-profile sandbox and mount set).
- O5 — GOV-F24 (BUILD `nv-approval-ledger`) and LOOP-F37, plus GOV-F23 (CONFIGURE: unattended resolvers set to deny).
- O6 — COST-F29 and COST-F30 (BUILD `nv-cost-cap`: per-session/per-day windows and the decision card).
- O7 — COST-F30 (BUILD) plus OPS-F58.a, RT-F01, RT-F02, GOV-F23, SCHED-F34 (CONFIGURE).
- O8 — GOV-F24 (BUILD) and OBS-F48 (MERGE→GOV-F25 [BUILD]: the outcomes ledger, NF-4) plus ten CONFIGURE rows, of which MEM-F44 / OBS-F46 / OPS-F58.a (`sessions.auto_prune: false`, request dumps, restart supervision) carry most of the durability weight.

Two qualifications the dispatch plan should carry anyway:

- **O7 is the thinnest in substance.** Six of its thirteen rows are ADOPT and the panel itself is native (OBS-F45, OPS-F58, CH-F49, CH-F50); the only thing built for O7 is the cost decision card. That is the intended shape under rule 6 — but it means O7's acceptance evidence is almost entirely "the native panel already shows this", so its acceptance tests must be run live on the one gateway rather than assumed.
- **Residual capabilities Hermes lacks with no row behind them** (each filed as a P8 upstream ask or an operator step, none dispatched): room creation and local membership have no `hermes` CLI verb and no local HTTP surface — desktop-only `groups.*` JSON-RPC, a one-time bring-up step (O3, O7; recorded in RT-F01, OBS-F45, OPS-F58, CH-F51); clarify entries are an in-memory dict, so a gateway restart drops a parked question (O5, O7; CH-F50); `hermes profile install` has no `--ref`, so pinning rests on source immutability (O2, O8; SELF-F55, SELF-F57); the OTLP exporter's event set is closed, so fleet outcome gauges cannot be published through it and Grafana parity is a script-only cron textfile (O8; OBS-F48); cron has no automatic backoff or auto-pause after N failures (O1, O8; SCHED-F33); enforcement on the codex app-server path is the `pre_tool_call` belt plus ESTOP only (O6; COST-F29); per-profile managed secret scope (O4; GOV-F27); and a turn-end hold for a turn that edited no files (O3, O5; LOOP-F37).
