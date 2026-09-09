# Hermes port — requirements, gap matrix, dispatch plan

Source of truth for the nemoclaw-coworkers Hermes port (git; the box copies these to
`data/shared/hermes/` at deploy time so the coworkers read the same text at `/workspace/shared/hermes/`).

| File | What |
|---|---|
| `requirements-v0.3.md` | the FR/SR/PR/NF requirements, with the v0.4 topology addendum on top |
| `nanoclaw-feature-inventory.md` | the NanoClaw features the 61 rows were derived from |
| `gap-matrix.md` | the 61 rows: id, name, status, feas, esc, **disposition**, **outcomes**, design note (Hermes-shaped) |
| `gap-matrix-evidence.md` | per-row evidence with paired `tag:` (v2026.8.31) and `main:` cites |
| `outcomes.md` | the eight outcomes the port exists for, and which rows carry each |
| `dispatch-plan.md` | batches 0 to 5 under the fleet baseline, rules, decisions, where progress shows |
| `drift-2026-09-07-CHANGELOG.md` | the upstream-drift correction pass (24 rewords, 2 trap fixes, dual cites) |
| `rebaseline-2026-09-09-CHANGELOG.md` | the Bot-Mode re-baseline (assessor to final disposition per row, 53 verifier findings) |

The fleet baseline every design is judged against is `container/spines/hermes/context/topology.md`
(loaded into every hermes role and the Orchestrator). Disposition totals after the re-baseline:
CONFIGURE 23, ADOPT 16, MERGE 11, BUILD 7, DEFER 4. The seven BUILD rows are six plugins:
nv-coworker-compose (LOOP-F35), nv-fleet-gates (LOOP-F37), nv-artifact (GOV-F25),
nv-approval-ledger (GOV-F24), nv-cost-cap (COST-F29 + COST-F30), podman-onecli (CRED-F28).
