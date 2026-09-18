# Hermes port autopilot: deterministic cores

The two scripts here are the pure-computation halves of the autopilot described in
[`docs/hermes-port/autopilot.md`](../../../docs/hermes-port/autopilot.md). They read files
and JSON, write JSON, and never touch the network, `ncl` or `gh`. The Orchestrator's task
prompts (and the Mac-side check) act on their output; nothing in here sends a message.

| Script | Spec | Reads | Writes |
|---|---|---|---|
| `hermes_queue.py` | §2.2 source A, §4 | `dispatch-plan.md`, `gap-matrix.md`, `ledger.md`, `config.json`, previous `state.json` | the state JSON: rows, `in_flight`, `merged`, `blocked`, `eligible_next` (with the §4.4 dispatch text per row), `wip`, `gating`, `alerts`, `plan_sha256`, plus `follow_up_rows` / `follow_up_in_flight` (§4.1: `<PARENT>.<letter>` ledger rows, parent recorded, never a WIP slot) |
| `hermes_supervise.py` | §2.3, §2.5, §3, §5 | that state, the row threads (+ the `operator_threads` key: the Orchestrator's DM / main / `system:tasks:*` sessions), `gh pr list --json`, the nudge ledger, optional sessions/cost, optional `--acks` (`acks.json`) | per in-flight row (follow-ups included): `stage`, `age_hours`, `slo_breach`, `action` (`none` / `nudge` / `escalate`), `target_role`, `message`, `infra_hold` / `bounced` / `idle_turn` / `operator_ask`; plus `actions` (hold, gate, nudge, alert — re-arm nudges carry `check`, `rearm_role`, `rearm_text`, `rearm_session_id`; operator-ask alerts carry `check: operator_ask` and the `DECISION NEEDED (<age>h): <row> — <head>` status line), `operator_asks`, the `alerts.md` lines and `acks.status` |
| `collect_threads.py` | §2.5, §6 | `ncl groups list`, `ncl sessions list`, then per session `ncl sessions messages` / `ncl cost-cap status` | `threads.json`: the role sessions per row thread with transcripts (`--rows`: the in-flight rows only), `other_threads`, `thread_case`, and pass 3 `operator_threads` — the Orchestrator's 6 newest non-row sessions of the last 48 h (never `hermes-status`, never its own `system:tasks:hermes-ap-*` series), read FIRST on their own reserve (`--operator-deadline-s`, default 3 s) and newest rows first (`--reverse`), 40 outbound lines each (+ the inbound answers since the oldest kept), 600 chars per line; `counts.operator_unread` says how many it could not read; `--operator-sessions 0` turns it off |
| `collect-acks.sh` (bash, HOST-side, hostname-guarded) | §2.5 | the central DB via `scripts/q.ts` (`./bin/ncl` fallback) for active `hermes-<ROW>` sessions, then ONE `bun:sqlite` readonly pass over their `outbound.db` files, then the tail of `logs/nanoclaw.log` | `data/shared/hermes/autopilot/acks.json` (tmp + rename): the newest `processing_ack` per session with role, canonical thread + `thread_id_raw`, container status, and the host's re-arm count per session over 24 h (`bounces_24h`, `last_bounce_at`). Run every 15 min by `refresh-viewers.sh` (`logs/collect-acks.log`); the supervisor ignores a copy older than 2 h |
| `rowid.py` | §2.5 | — | the one canonical spelling of a `hermes-<ROW>` thread: `canon_thread("hermes-iso-f13") == "hermes-ISO-F13"`, `hermes-Iso-F10.A` → `hermes-ISO-F10.a`, non-row threads / None / "" unchanged. Imported by `collect_threads.py`, `rows-board.py` (and through it `slack-rows.py`); the two heredoc scripts (`collect-acks.sh`, `pull-state.sh`) carry an inline copy that `test_rowid.py` checks against it |
| `abtr.py` (CLI: `scorecard.py --markdown [PATH]`, `--brief [PATH]`) | §7 | `state.json`, `ledger.md`, `alerts.md`, `prs.json`, `config.json` | the a \| b \| t \| r report: one markdown line per row with architect, builder, tester, reviewer and the gate as cells (`✓ HH:MMZ` done, `▶ 3.6h` active, `✗ FAIL r2`, `⏸`, `·`), in-flight rows first by age, then blocked, then merged, then the queued count |

`pull-state.sh` writes the report every tick to `groups/orchestrator/reports/status/autopilot.md` (container `/workspace/agent/reports/status/autopilot.md`, viewer `/status/autopilot.md`) and its brief (header + one `<row> | a | b | t | r` line per in-flight row) to `data/shared/hermes/autopilot/tick-report.txt`, which the supervise tick ends its turn with and `hermes-check.sh` prints first.

```bash
python3 hermes_queue.py --plan dispatch-plan.md --matrix gap-matrix.md --ledger ledger.md \
  [--config config.json] [--state state.json] [--now ISO] [--json] > state.json
python3 hermes_supervise.py --state state.json --threads threads.json --prs prs.json \
  --nudges nudges.json [--sessions sessions.json] [--acks acks.json] [--config config.json] --now ISO [--json]
ROOT=~/haaggarwal/nemoclaw-coworkers bash collect-acks.sh   # box only: writes data/shared/hermes/autopilot/acks.json
```

`acks.json` is `{"generated_at": ISO, "sessions": {"<session-id>": {"status", "changed", "role", "thread_id",
"thread_id_raw", "container_status", "message_id"[, "thread_case": true][, "bounces_24h", "last_bounce_at"[, "bounces_undated"]]
[, "ack_empty": true]}}, "thread_case": [...], "bounce_log": {...}}` — the newest `processing_ack` row per active
`hermes-<ROW>` session, read on the host because the container cannot see other sessions' `outbound.db`. `thread_id` is
the canonical row thread (`rowid.canon_thread`), `thread_id_raw` the thread the session really lives on; `bounces_24h`
counts the host sweep's "Re-armed bounced a2a handoff" log lines for the session (the sweep clears the bounced ack it
retries, so the log is the only record of a repeat) over the counted window — the last 24 h, or since the newest
`NanoClaw starting` line / a quiet stretch longer than `LOG_MAX_GAP_H` (6 h), whichever is shorter, because the clock-only
stamps cannot date a line across a silence; re-arms beyond that boundary are `bounces_undated` (present only when > 0,
never dated, never a repeat). Both are omitted when `logs/nanoclaw.log` is unreadable. A session whose only ack row was
the bounced one the sweep deleted is listed ack-less (`status`/`changed` null, `ack_empty`) when the log shows re-arms
for it. Missing or older than 2 h, the supervisor reports `acks.status` `missing` / `stale` and skips the bounce and
idle-turn detections (§2.5).

`threads.json` is `{"hermes-<ID>": [{"ts", "direction", "text", "sender"?, "kind"?}]}`, the
collector's flattening of the role sessions on each row thread, plus the one non-row key
`"operator_threads": [{"session_id", "thread_id", "role", "messages": [...]}]` (the Orchestrator's
operator DM / main / `system:tasks:*` sessions, for the operator-ask detection). A row whose value is not a
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
  then batch 3 (`podman_box`) / batch 4 / adopt@P5 on batch 2 merged, then batch 5 (`FLEET-F62`,
  the fleet-assembly BUILD row) and adopt@P6 on batches 3 and 4 merged, then batch 6 (`OSH-F63`,
  `OSH-F64` — the P7 OpenShell substrate and demo BUILD rows, 2026-09-17) on `batch5_merged` (every
  batch 5 row merged or waived); inside batch 6 the lead row `OSH-F63` gates `OSH-F64` the way 1a
  gates 1b (rule 3, machine-enforced 2026-09-18): `OSH-F64` also waits on `osh_f63_first_pass`
  (OSH-F63 merged / waived or a tester PASS at its head) and its merge holds on `osh-f63` until
  `osh_f63_merged`; the FIRST eligible BUILD row jumps the queue when no BUILD row is in flight (a
  BUILD row already in front stays — two adjacent BUILD rows never swap); DEFER and MERGE-> rows
  never dispatch
- never twice: a ledger row, a `dispatched_at` in the previous state, or `paused_rows` excludes a row
- `idle-capacity` (the 2026-09-17 seven-tick "nothing to do"): free WIP slots ≥ 2, nothing eligible, and `paused_rows`
  holding rows whose gates are all met → one alert naming them (`row` null, so it is keyed `(plan, idle-capacity)`,
  one line per 24 h); rows behind an unmet gate, `config.paused` or fewer than 2 free slots never raise it
- nudge at most once per row per 6 h across states; escalation needs a nudge in the current
  state first (`blocked`, cost cards and environmental `ESCALATE` reports escalate at once)
- `FAIL ×2` is the cap (two counted FAILs); a plain `ESCALATE` report is environmental and
  not a round; `authorize_round` in `config.json` lifts the cap once
- holds (`1a`, `batch2`, `batch3+4` — batch 5 and the P6 adopt row —, `batch5` — batch 6 —, `osh-f63` — OSH-F64 behind the batch-6 lead row —, `core-change`, `paused`) pause the SLO; `hold-too-long`
  after 48 h; a cost-held row is never nudged
- one event per send: every role's session on a thread is read, so a send appears as the
  sender's `out` and the receiver's `in`; copies within 15 minutes collapse to one event, and
  PR-bearing events naming another PR are ignored once the row's PR is known
- a thread with any unread session is `null` in the supervisor's input and draws no action;
  `pull-state.sh` reads transcripts only for the queue's in-flight rows (`--rows`) and stops at
  `COLLECT_DEADLINE_S` (`--deadline-s`, 10 s under the gates)
- an architect or orchestrator session already on `hermes-<ID>` marks the row dispatched for the
  queue (never dispatch twice), even before the ledger row or the `record.py` entry exists
- operator asks (§2.5, the 2026-09-16/17 incident — three asks unanswered 11–14 h behind `hold 0, infra_hold 0`):
  an outbound line by the Orchestrator or any role that addresses the operator — EXPLICIT (always): `without
  operator authorization`, `operator ruling/decision/go/authorization needed|required|pending`, `needs the
  operator's call`, `escalate|escalating … to the operator` (never the past-tense recount `escalated …, answered
  …`), `HOLDING for the operator's go`, `operator rules …`, `awaiting / waiting on the operator`, `deploy-now vs
  defer-carry`, `One ruling:`; IMPLICIT (`your call (again)`, `needs your call/ruling/go`, `please rule`) only when
  the text also says `operator` or the Orchestrator writes it on its own operator DM / task thread — on a row
  thread "your call" is chain traffic, and a first line addressing a role by name never asks — that no later
  operator inbound (`Operator …` in any case on a row / `system:tasks:*` thread; ANY non-role inbound on the DM,
  `Open it`), resolution line (`ruling in`, `operator ruled`, `per the operator's ruling`, `Ack —`), progress
  marker (a ROLE's ask only: the Orchestrator's stands while the roles keep working) or — on a row thread —
  plain line by the asking role (a card caption or a restatement is not one) followed, is the `operator-ruling`
  alert `DECISION NEEDED (<age>h): <row> — <first 140 chars>` (key `operator-ruling:ask:<digest of the text>`:
  once per ask text per 24 h, a mirrored DM copy collapses into the row's alert — under a two-row lead-in too,
  `collapsed_into` —, a reworded ask is new), the newest standing ask per row, no nudge and no re-arm (we are the
  blocker), the row's SLO check still running; read on the row threads AND on the collector's `operator_threads`,
  where an ask is attributed to the one plan / follow-up row its 600-char scan names, else to the synthetic row
  `OPERATOR` (a named row nobody supervises this tick falls there too); the supervise tick's own run output
  (`Hermes autopilot · …`, the quoted `DECISION NEEDED` lines, the a|b|t|r rows) is never an ask and its task
  series is never read; a paused row is silent; `record.py alerted --row OPERATOR` books it like any row; the
  brief leads with the DECISION NEEDED lines (`state.operator_asks`)
- follow-up rows (§4.1): a ledger row `<PARENT>.<letter>` with a matrix-row parent (`SCHED-F34.a`, `ISO-F10.a`)
  is `follow_up_rows[<id>]` (`parent`, ledger state, the parent's batch) and `coverage.follow_ups`, never
  `ledger-unknown-id`, never in `in_flight` / WIP / the dispatch order (nor the supervisor's `summary.in_flight`
  or the demo tracker's slots); a criterion carried onto it lands on it (DEFER judged by the parent's batch); the
  supervisor runs it as an in-flight row on `hermes-<ID>` only while its ledger state is in flight
  (`summary.follow_ups`); `ZZZ-F99` and `ZZZ-F99.a` (unknown parent) still alert
- three stalls the markers do not show (§2.5, the 2026-09-15/16 incidents): an outbound `blocked (infra` /
  `Hold (NOT a verdict` / `HOLD on <ID>` line (or "pending an operator ruling" in its first three lines)
  that nothing followed — no marker, no later plain line by the same role — alerts `infra-hold` /
  `operator-ruling` at once and asks the Orchestrator, once per hold text, to re-arm the role, while the
  row's SLO check keeps running; a `bounced-*` ack newer than the role's last line is a re-arm nudge at
  once, once per ack (`bounced-transient`: probe the provider first, never spawn fresh), and the next
  bounce after a sent re-arm is the `bounce-repeat` alert only (no second re-arm — one per outage); a
  `completed` ack with a stopped container, no marker after it, no `[Blocker]`/hold as the turn's last
  word and ≥ ½ the stage's nudge SLO (min 1 h) is an early nudge, once per turn end. Re-arm lines start
  `Supervisor re-arm <ID> · <role>:`, are never the row's 6 h nudge, and are capped at one sent per row
  and role per 6 h (the book's timed `rearms`); a paused row is silent; with `acks.json` missing or
  > 2 h old the two ack-based checks are off and `acks.status` says so
- bounce history (the 2026-09-16 ISO-F14 incident): a role session with `bounces_24h` ≥ 2 in `acks.json` is the
  `bounce-repeat` alert even while its newest ack is `completed` / `processing` (or it has no ack row at all —
  `ack_empty`), and a current bounce with ≥ 2 behind it is a repeat, not a re-arm; same 24 h key per (row, state);
  the SLO check still runs; a session without the field behaves exactly as before; `bounces_undated` is never read
- thread case (the 2026-09-16 ISO-F13 incident): every place a thread names a row reads it through
  `rowid.canon_thread` (`collect_threads.py`, `collect-acks.sh`, `pull-state.sh`, `dispatch-cron.sh`, `rows-board.py`,
  `slack-rows.py`; free-text `hermes-<ROW>` / `[<ROW>]` mentions in any casing too), so a session or card dir on
  `hermes-iso-f13` belongs to ISO-F13 in `threads.json`, `acks.json`, the rows board and the Slack mirror; the record
  keeps the real thread (`thread_id_raw`), every pinned nudge / re-arm to such a session carries it in `thread_id`
  (`row_thread_id` = the canonical one), and one `thread-case` alert per (row, raw thread) per 24 h rides beside the
  row's ordinary action. Only a SPELLING of the row thread counts: a session attached by mention alone (`inferred`,
  living on a DM such as `hermes-P0-LOOP`) is neither a thread case nor re-routed. If a role has sessions on both
  spellings, nudges / re-arms pin `pick_target_session`'s choice (running > active > newest) and carry that
  session's real thread; the board lists both; two card dirs merge, the newest `latest` per role wins

Two deliberate readings of the spec: a DEFER or MERGE-> id found in the ledger keeps its
ledger state (it is holding containers) and raises `plan-violation` instead of being hidden
as `deferred` / `carried`; and batch 1a is eligible without waiting on `P0-LOOP` (plan
decision 1: the two are independent), with `gating.batch0_merged` reported for the human.

Run the checks:

```bash
python3 -m unittest discover -s ops/nemoclaw-coworkers/autopilot -p 'test_*.py'   # incl. test_pull_state.py: pull-state.sh + both gates offline
uvx ruff@0.16.2 check ops/nemoclaw-coworkers/autopilot/
```
