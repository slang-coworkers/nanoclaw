# Hermes port autopilot: deterministic cores

The two scripts here are the pure-computation halves of the autopilot described in
[`docs/hermes-port/autopilot.md`](../../../docs/hermes-port/autopilot.md). They read files
and JSON, write JSON, and never touch the network, `ncl` or `gh`. The Orchestrator's task
prompts (and the Mac-side check) act on their output; nothing in here sends a message.

| Script | Spec | Reads | Writes |
|---|---|---|---|
| `hermes_queue.py` | §2.2 source A, §4 | `dispatch-plan.md`, `gap-matrix.md`, `ledger.md`, `config.json`, previous `state.json` | the state JSON: rows, `in_flight`, `merged`, `blocked`, `eligible_next` (with the §4.4 dispatch text per row), `wip`, `gating`, `alerts`, `plan_sha256` |
| `hermes_supervise.py` | §2.3, §3, §5 | that state, the row threads, `gh pr list --json`, the nudge ledger, optional sessions/cost | per in-flight row: `stage`, `age_hours`, `slo_breach`, `action` (`none` / `nudge` / `escalate`), `target_role`, `message`; plus `actions` (hold, gate, nudge, alert) and the `alerts.md` lines |

```bash
python3 hermes_queue.py --plan dispatch-plan.md --matrix gap-matrix.md --ledger ledger.md \
  [--config config.json] [--state state.json] [--now ISO] [--json] > state.json
python3 hermes_supervise.py --state state.json --threads threads.json --prs prs.json \
  --nudges nudges.json [--sessions sessions.json] [--config config.json] --now ISO [--json]
```

`threads.json` is `{"hermes-<ID>": [{"ts", "direction", "text", "sender"?, "kind"?}]}`, the
collector's flattening of the role sessions on each row thread. A row whose value is not a
list (the collector could not read it) gets no action this tick. `nudges.json` is
`{"<ID>": "<ISO>"}` or `{"<ID>": {"last_nudge", "state", "count", "alerts": {"<kind>:<state>": "<ISO>"}}}`;
the `alerts` map is what bounds escalations to one per (row, state) per 24 h.

Rules pinned by the tests (`test_hermes_queue.py`, `test_hermes_supervise.py`):

- ids are `^[A-Z0-9]+-F[0-9]+(\.[a-z])?$` whole-cell; `P0-LOOP` and friends are `other_rows`;
  a decorated cell naming exactly one id (`LOOP-F35 (1a)`, `[LOOP-F35]`, a U+2011 hyphen) is read
  as that id and raises `ledger-id-spelling`, so the row keeps its WIP slot and is never re-dispatched
- ledger columns come from the header row; `merged` / `blocked:` are scanned anywhere in the
  outcome cell, last token wins; `blocked: STOP` is terminal, `blocked: P<n>` is `gate_red`
- ledger stamps without a zone are install time (`install_tz_offset_minutes`, default IST)
- WIP counts every ledger row that is not merged or blocked; `blocked` rows free their slot
- order: 1a, then 1b waves / batch 2 / adopt@P2 / adopt@P3-waveA on 1a's first tester PASS,
  then batch 3 (`podman_box`) / batch 4 / adopt@P5 on batch 2 merged, then adopt@P6; a BUILD
  row jumps the queue when no BUILD row is in flight; DEFER and MERGE-> rows never dispatch
- never twice: a ledger row, a `dispatched_at` in the previous state, or `paused_rows` excludes a row
- nudge at most once per row per 6 h across states; escalation needs a nudge in the current
  state first (`blocked`, cost cards and environmental `ESCALATE` reports escalate at once)
- `FAIL ×2` is the cap (two counted FAILs); a plain `ESCALATE` report is environmental and
  not a round; `authorize_round` in `config.json` lifts the cap once
- holds (`1a`, `batch2`, `batch3+4`, `core-change`, `paused`) pause the SLO; `hold-too-long`
  after 48 h; a cost-held row is never nudged
- one event per send: every role's session on a thread is read, so a send appears as the
  sender's `out` and the receiver's `in`; copies within 15 minutes collapse to one event, and
  PR-bearing events naming another PR are ignored once the row's PR is known
- a thread with any unread session is `null` in the supervisor's input and draws no action;
  `pull-state.sh` reads transcripts only for the queue's in-flight rows (`--rows`) and stops at
  `COLLECT_DEADLINE_S` (`--deadline-s`, 10 s under the gates)
- an architect or orchestrator session already on `hermes-<ID>` marks the row dispatched for the
  queue (never dispatch twice), even before the ledger row or the `record.py` entry exists

Two deliberate readings of the spec: a DEFER or MERGE-> id found in the ledger keeps its
ledger state (it is holding containers) and raises `plan-violation` instead of being hidden
as `deferred` / `carried`; and batch 1a is eligible without waiting on `P0-LOOP` (plan
decision 1: the two are independent), with `gating.batch0_merged` reported for the human.

Run the checks:

```bash
python3 -m unittest discover -s ops/nemoclaw-coworkers/autopilot -p 'test_*.py'   # incl. test_pull_state.py: pull-state.sh + both gates offline
uvx ruff@0.16.2 check ops/nemoclaw-coworkers/autopilot/
```
