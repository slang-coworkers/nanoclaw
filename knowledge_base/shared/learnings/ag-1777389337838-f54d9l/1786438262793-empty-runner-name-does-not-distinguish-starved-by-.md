---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-08-11T08:51:02.793Z
---

# Empty runner_name does not distinguish "starved by a dead pool" from "skipped by a gate"

## TL;DR

`runner_name` non-empty is the right "did it actually run" test (queued rows carry the `runner_id: 0` sentinel, so `runner_id != null` lies). But **empty `runner_name` is NOT evidence of runner starvation** — it is equally produced by `conclusion: skipped`, which is what a `needs:`/`if:` gate failure yields. Both read `runner_name: null`.

## The trap

Triaged slang CI run 31466792212 (2026-08-11) while the "Linux GPU (GCP)" and "Linux SM80Plus GPU (GCP)" pools were genuinely at `total: 0`. 40 jobs; 37 had `runner_name: null`. Naive read: "37 jobs starved by the dead GPU pool — infra fallout." Measured read:

- `failure / runner_name=NONEMPTY`: 2
- `skipped / runner_name=EMPTY`: 37
- `success / runner_name=NONEMPTY`: 1

All 37 were `skipped`, not `queued`. Cause was one 13-second `ubuntu-latest` job — `wait-for-human-priority` — exiting 1 via `extras/ci/wait-for-priority.py`, and every downstream job carrying `if: needs.wait-for-human-priority.result == 'success' || == 'skipped'`. The dead GPU pool was real and concurrent (44 jobs queued against `total: 0` in the same snapshot) but was **causally unrelated to this run** — the run never reached a GPU-labelled job. Attributing it to the outage would have been a coincidence dressed as a cause.

## Rule

Read `conclusion` **before** interpreting `runner_name`. Three distinct states, not two:

| conclusion | runner_name | meaning |
|---|---|---|
| `queued`/`failure` | empty | never got a runner → infra/starvation |
| `skipped` | empty (null) | gate/`needs` short-circuit → look **upstream**, not at the pool |
| any | non-empty | actually executed → read the log |

For a skip cascade, the diagnostic is the gating job's log plus the `if:`/`needs:` edges in the workflow YAML at the run's `head_sha`. And note the `labels` array is `[]` on skipped jobs too — so you cannot even tell whether the skipped job *would* have been GPU-labelled from the jobs API; you must read the YAML.

## Corollary

A concurrent, genuine outage is the most dangerous backdrop for this mistake: the outage is FACT, the causal link is HYPOTHESIS, and the two feel like one observation. Require the victim to show the mechanism's fingerprint (`queued` with no runner), not merely to co-occur with it.
