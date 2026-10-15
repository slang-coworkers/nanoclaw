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

- **Ceiling** = a runtime DB value set with `ncl cost-cap set --ceiling` (see [below](#runtime-configuration--ncl-cost-cap-elevated-only)) — **the env var `NANOCLAW_COST_T2_CEILING_USD` is a deprecated legacy fallback**, consulted only when no DB value is set. Typical value **$150** (reviewed monthly): it sits above even fixer's p95 ($142) → never bites legit work, and hard-stops runaway far below $1000.
- **Immortal is never silently blocked.** The orchestrator must stay alive; its bound is the human, who funds it via Continue. This is what flags (not kills) a $625-type main run.
- **Everything is reversible.** A stopped session resumes via dashboard **Continue** or `/clear`; a new session resets the counter.

## Windows
- **Non-immortal:** per-session lifetime — the counter is that session's total spend (survives container respawn; resets on new session / `/clear`).
- **Immortal:** per-UTC-day — resets daily so the orchestrator isn't bounded forever by one busy day.

## Where the numbers live
- **Per-group p90:** dashboard computes it over each group's real 7-day sessions → `data/cost-thresholds.json` (`perGroupP90Usd` map); host reads the group's value at spawn (`resolveCostCapT2Usd`).
- **Ceiling:** the `cost_cap_policy` DB table, set with `ncl cost-cap set` (below). `NANOCLAW_COST_T2_CEILING_USD` in `.env` is a deprecated legacy fallback only.
- **Live state:** `outbound.db` → `session_state.cost_cap` = `{ capUsd, spentUsd, status, immortal, window, decision }`; the dashboard **Sessions** tab renders spend / cap / status with Continue / Stop.

## What `spentUsd` counts (accounting v3)

Two sources, both folded into one counter by `applyCostDelta` in `container/agent-runner/src/poll-loop.ts`:

1. **Claude** — priced **per API call**, deduplicated by wire `message.id` and topped up to the call's **final** usage (`recordMessageCost`), then settled at each turn's `result` against the SDK's own cumulative `modelUsage` (`settleClaudeTurn`, math in `container/agent-runner/src/claude-usage.ts`). Task-tool **subagent** calls are included: the provider sets `forwardSubagentText: true` so their blocks reach the stream (their transcripts live in a separate file that nothing routes back to the session, so an on-disk scan would misattribute them), and the `text` delivery door is gated on `parent_tool_use_id == null` so a nested agent's prose is never delivered.
2. **Codex MCP-tool** — `mcp__codex__codex` runs as a stdio child, so none of its inference reaches the Claude stream. `container/agent-runner/src/codex-cost.ts` reads `$CODEX_HOME/sessions/**/rollout-*.jsonl` (a per-session mount, so no attribution problem) and folds the delta against a persisted per-(file, UTC-day) ledger. Rates were derived from `ccusage codex daily`, the same oracle the dashboard's Overview prices with. Billing is **per call** (`info.last_token_usage`), de-duplicated by the `(model, input, cached, output)` tuple **across files** — a codex subagent thread spawn writes its own rollout that replays the parent's already-billed turns, so summing each file independently over-counts (measured 13.7% and 19.2% on the two of thirty sampled prod sessions that had forks).

> **Why per call, deduplicated, then topped up.** The stream emits one assistant message per CONTENT block — thinking, text and tool_use arrive separately — and every block of one API response repeats the same `message.id` and the same usage: the `message_start` **snapshot**. Its input and cache fields are final; its `output_tokens` is only what was generated before the first block closed (1–30). Captured on Agent SDK 0.3.289 / Claude Code 2.1.296 (fixtures in `container/agent-runner/src/providers/__fixtures__/claude-usage/`):
>
> | Source | What it carries |
> |---|---|
> | each `assistant` block | the start snapshot (e.g. `output_tokens: 8`) |
> | `stream_event` → `message_delta` | the main-thread call's FINAL usage (e.g. `235`); `includePartialMessages: true` |
> | subagent transcript (`SubagentStop` → `agent_transcript_path`) | each subagent call's FINAL usage — subagents emit no `message_delta` |
> | `result.usage` | main loop only, per turn |
> | `result.modelUsage` | every pipeline call — main loop, subagents, **compaction**, Claude Code's **helper** calls (a Haiku call on most turns) — **cumulative** per SDK session, across turns and restored on resume |
>
> Accounting v1 charged the end-of-turn figures once per `query()` call; `total_cost_usd` is cumulative across turns and resumes, so it over-counted (2.11x on the session that motivated #1327). v2 (#1327) charged the first block of each id — the snapshot — and so kept **~1% of output tokens** and never saw compaction or helper calls (prod, 2026-10: a call charged as 8 output tokens that the transcript and the OneCLI gateway both record as 8,178; fleet ledger $33.8K vs gateway-priced $43.5K since 2026-09-04). v3 charges the first report of each id in full, then only the increase each later report adds, and at each `result` charges `max(0, S − P − credit)` per model and token field, where S is `modelUsage` rebased to the session's tracking start, P the per-call tokens already charged and credit the backstop residual no call has claimed yet. A late final for a call the SDK had already counted (a background subagent whose transcript is read after the result) consumes that credit instead of being charged again.
>
> **Segments and the restore baseline.** Accounting runs in segments, one per `query()` (one Claude Code process, within which `modelUsage` only grows). Before the query starts, the runner reads the totals the SDK is about to restore: the last `cost-state` entry Claude Code wrote into the session transcript when its previous process ended (`readRestoredModelUsage`). If that is unreadable, it uses the checkpoint it saved at that session's last settled result. The first result is then differenced exactly, so a compaction in the first turn of a resumed query is charged — the prod pattern behind slang-triager's 112 uncharged compaction calls ($293, 15.7% of its spend since 2026-10-06). Only with neither baseline is the first result absorbed (a WARNING is logged). Totals that go backwards (a restore smaller than the baseline) restart that model's accounting from the per-message spend since the last result, so earlier spend can never mask later spend. A zeroed crash result is skipped.
>
> **Atomic, append-only, fail-closed.** Each accounting event — a message report, a turn settlement, a segment start — is ONE outbound.db transaction: `cost_cap` spend, the backstop state (`session_state.cost_claude_backstop`) and the event's `cost_events` rows commit together; an escalation row raised by the charge is written after the commit. Claude ledger rows are append-only and signed: a call's first report is its base row, and every later change (the final usage, a model correction, a residual claimed back) is a new row stamped with the time it was charged, so each lands in the budget window the counter charged it to. The rows are also the durable per-message dedup record: a report after a respawn tops up from them instead of re-charging. A failed event rolls back, restores memory, and is retried in order before the next one; while any event is unrecorded the session takes no new work and ends its stream at the turn boundary. A query never starts without its segment committed: after a short retry (`NANOCLAW_COST_SEGMENT_RETRY_MS`, 30 s) the runner exits and the next one re-claims the batch. Immortal groups are not halted; their queue is bounded (10,000 events, oldest per-call reports dropped first — the backstop settles those calls from the cumulative). A pending event never runs against another budget window: a `/clear` or a UTC rollover in between discards it. In a daily window a correction that lowers a charge made on a day that has closed (a model or TTL re-price, a late call claiming residual credit at a cheaper TTL) is not refunded today: an adjustment row cancels it in today's ledger.
>
> **Exact prices.** A call reported first without a model is priced as the configured model and moved to the model a later report names (signed correction); if a result had already used it to offset that model's residual, the residual is re-settled at once. An unsplit cache write re-reported with an equal TTL split takes the split. Residual cache writes take the session's main-thread TTL; when a call later claims a residual priced at the other TTL, the difference is corrected in either direction.
>
> **Closing a segment.** When a query starts, the segment it replaces is first settled against the cumulative its SDK session ended at — the transcript's last `cost-state`, which Claude Code writes as its process exits and which equals the last result's `modelUsage` when nothing ran after it (so a normal end settles nothing more). This is what keeps accounting whole across a process boundary: a main-thread final the runner never read, a background subagent finishing after the last result, a helper call at exit, or an accounting event that never committed before a restart are all in that total, and are charged once, as `max(0, S − P − credit)`, in the new segment's transaction. A fresh next query reads the replaced session's own transcript. At container start the previous process's segment is closed this way BEFORE the continuation rotation can delete its transcript; if that cannot commit, the transcript is kept (no rotation that start). A cost-state no newer than the segment's last result (the process was killed outright and wrote none) settles nothing and covers nothing, so a later final for a call after that result still tops it up.
>
> **Across processes.** A report for a call charged by an EARLIER process is ignored when a settlement of that process's segment (a result, or its closing) came after the call, and topped up directly when nothing covered it.
>
> **Hard stop, and every other exit.** On a ceiling (or fail-closed) stop the query's input is ended and the rest of its stream is read for accounting only — a background subagent can still report — for up to `NANOCLAW_COST_STOP_DRAIN_MS` (default 120 s). On every exit (an abort for a slash command, an abandoned or failed stream) the finals the provider queued but never yielded are charged.
>
> **SubagentStop read.** The hook's `session_id`, its `transcript_path` and the session the running query's `init` announced must agree (nothing is read before that `init`), and only a regular `agent-*.jsonl` in that session's directory (`<project>/<session>/subagents/`) is read; it is opened without following a symlink and must be the validated file (device and inode, and on Linux the descriptor's resolved path). It is read asynchronously in 4 MiB chunks and incrementally (a re-fired hook reads only appended lines), up to 256 MiB or 10 s per invocation (`NANOCLAW_SUBAGENT_READ_BUDGET_BYTES`) so the turn is never held; what is not read is in the turn's `modelUsage`, which the backstop settles. A last record without a newline is read too, since the transcript is complete when the hook fires. Counts are validated and timestamps canonicalized. The hook is registered only when the session is metered.
>
> **Known gaps.** (1) A nested `claude --print` process launched by a skill (e.g. the external `slang-pr-review-runner` / `slang-clarity-review-runner`) is a separate SDK session the runner never sees — its spend reaches neither the ledger nor the ceiling; on prod it is most of `slang-reviewer`'s spend. Fix: gateway attribution (session-tagged requests), planned. (2) Claude Code calls outside the query pipeline (permission classifier, token-count probes) are excluded from `modelUsage` by the SDK. (3) A process killed outright (no `cost-state` written) leaves its off-stream spend since its last result, and the finals it never reported, uncharged. (4) A resumed session with neither a transcript `cost-state` nor a checkpoint absorbs its first result's off-stream calls (logged): charging them would charge the restored history too, and rotating the session or refusing the resume would change the conversation, not the accounting. (5) Residual cache writes (compaction, helper calls) are priced at the session's main-thread TTL; the SDK's `costUSD` cannot decide the split, because it is not computed from our rate table (captured: $0.1155 for a `claude-sonnet-5-5[1m]` session whose tokens price at $0.0736 all-5m and $0.1131 all-1h).
>
> **Acceptance check on prod:** `scripts/verify-cost-ledger-vs-gateway.py --session <id>` joins a session's `cost_events` to the OneCLI gateway's `request_logs` on the exact (input, cache-read, cache-write) token tuple and reports ledger vs gateway output tokens and dollars.

### Daily ledger-vs-gateway drift check

The ledger once kept ~1% of each call's output tokens for weeks (#1329, fixed by #2013) and nothing noticed. A daily check now compares the ledger to the gateway, so drift like that gets caught.

- **What runs:** `scripts/verify-cost-ledger-vs-gateway.py --fleet --hours 24`. It checks every session under `data/v2-sessions/` whose ledger has a Claude call first reported in the window. Calls are joined to their agent group's gateway calls with the same exact-tuple ±300 s join as `--session`. The script runs one gateway query per group, and each gateway call can match at most one ledger call. Read-only: SQLite is opened `mode=ro` and Postgres only gets `SELECT`.
- **FAIL (exit 2)** when (a) any matched call's output tokens differ from the gateway's, (b) the fleet-wide matched-$ drift (ledger vs gateway tokens priced with `pricing.ts`) is above **both** 1% and $1 (`--max-usd-drift-pct`, `--max-usd-drift-abs`), or (c) a session with ≥ 10 ledger calls (`--min-calls`) matches less than 90% of them (`--min-match-frac`). Case (c) means the gateway lost the calls, or the ledger's input tuple drifted. **Exit 1** means the check could not run, for example when the gateway is unreachable or `pricing.ts` cannot be parsed.
- **Reported, never alerted:** gateway calls that match no ledger call, listed per group (`unmatched_gateway_by_group`). Most of these are the nested `claude --print` runs inside review skills, which the session counter intentionally does not count (known gap 1 above).
- **How the alert reaches the operator:** the host sweep's `singleton:cost-drift-check` duty (`src/modules/cost-drift-check/`) runs the script once every 24 h. Each run uses `--since` set to a coverage cursor (`checkedThrough`), which is the start time of the last run that completed. Because of this, a late run leaves no gap, and when a run ends in ERROR its window is checked again by the next run. The first run looks back 24 h. After an outage, the catch-up window is capped at 7 days. The run is detached and single-flight, so it never holds a sweep tick open. On FAIL, and also when the check could not run, the duty DMs the operator. It picks the recipient the same way approval cards do: global admins, then owners, via `pickApprover` / `pickApprovalDelivery`. A PASS is only logged (`Cost drift check PASS`, including the per-group unmatched gateway calls). The last run time and verdict are kept in `data/cost-drift-check.json`. The run time is stamped before the run starts, so a host restart does not re-run the check.
- **Enable (opt-in):** set `NANOCLAW_COST_DRIFT_CHECK=true` in `.env` and restart the host. The first run happens on the next sweep tick, then every 24 h after that. The script reaches Postgres with `docker exec` (`ONECLI_PG_CONTAINER`, default `onecli-postgres-1`; `ONECLI_PG_USER` / `ONECLI_PG_DB`, default `onecli`). To run the check again now, delete `data/cost-drift-check.json`.
- **Without the host duty** (e.g. a box where it is not enabled), cron the script through `scripts/cron-run.sh`, which turns a non-zero exit into a marker under `data/shared/.cron-failures/` and a line in `logs/cron-failures.log`:
  ```
  20 6 * * * REPO/scripts/cron-run.sh cost-drift /usr/bin/python3 REPO/scripts/verify-cost-ledger-vs-gateway.py --fleet --hours 24 --checkout REPO >> REPO/logs/cost-drift.log 2>&1
  ```

**Upgrade behaviour.** `session_state.cost_cap.accountingVersion` is `3` (v2 was #1327). A session carrying a v1 or v2 `spentUsd` keeps it — the inflation factor is per-session and unknowable, and lowering a recorded spend is the unsafe direction. It clears at the next window reset (UTC rollover for daily, `/clear` or a `new_session` batch for lifetime). Codex history that predates the fix is **baselined**, not billed: the first fold absorbs it into the ledger without charging, so deploying cannot retroactively hard-stop live sessions.

**Scope.** Codex accounting covers codex reached from a Claude session via MCP (how `codex-critique` and every coworker overlay use it). A group configured to run the codex provider *natively* is still unenforced — `costEnabled` requires `providerName === 'claude'`.

## Runtime configuration — `ncl cost-cap` (elevated only)
**`ncl cost-cap set` is the way to configure the cost cap.** The ceiling and per-group caps no longer require a redeploy or an `.env` edit. An operator (or the `cli_scope=global` orchestrator) sets them at runtime; the host reads the DB (`cost_cap_policy` table) at the **next container spawn** and materializes the values into `container.json`.

> **`NANOCLAW_COST_T2_CEILING_USD` / `NANOCLAW_COST_T2_USD` are deprecated.** They remain wired only as a last-resort fallback so a pre-existing install that set them doesn't suddenly lose its ceiling. New configuration should go through `ncl cost-cap`; an install that sets nothing behaves exactly as before. The env vars can be removed from `.env` once the DB carries the values.

```
ncl cost-cap get                                   # effective fleet ceiling + every override
ncl cost-cap get --group slang-fixer               # a group's effective cap + ceiling
ncl cost-cap set --ceiling 150                      # fleet-wide Tier-2 ceiling
ncl cost-cap set --ceiling 300 --group slang-fixer  # per-group ceiling override
ncl cost-cap set --cap 60 --group slang-fixer       # per-group Tier-1 cap override (requires --group)
ncl cost-cap set --ceiling 0                         # explicitly disable the ceiling (beats the env var)
ncl cost-cap clear [--group <folder>]               # remove an override → restore env/thresholds fallback
ncl cost-cap status --session <session-id>          # ONE session's LIVE observed status (see below)
```

- **`get`/`set`/`clear` are POLICY** (the configured ceiling/cap numbers); **`status` is RUNTIME
  observed state** for one specific session — `'ok'` | `'warn'` | `'escalated'` | `'stopped'` | `'unknown'`
  (no cost-cap row yet), read directly from that session's `outbound.db` (`session_state` table, key
  `cost_cap` — the same row the dashboard's cost-approval card reads). Consumers that need to tell "the
  session is idle" from "the session is `stopped` pending a human Continue/Stop decision" (e.g.
  `/supervise-issues`'s `pull-universe.sh`, which stamps every `gh-issue-*` session with it) want
  `status`, not `get`. Source: `src/cli/session-cost-cap.ts`.
- **Resolution precedence.** Cap: **DB per-group `cap_usd`** → `NANOCLAW_COST_T2_USD` env → `cost-thresholds.json` per-group p90 → fleet p90 → `$100` default (the auto-sourced tail is floored at `$10`; the two explicit operator overrides — DB and env — bypass the floor). Ceiling: **DB per-group `ceiling_usd`** → **DB fleet `ceiling_usd`** → `NANOCLAW_COST_T2_CEILING_USD` env → `0` (no ceiling). A stored DB value wins over the env var, **including `0`** (an explicit "no ceiling").
- **`--group <folder>`** is the group's workspace folder — the same key `cost-thresholds.json` uses (`perGroupP90Usd[folder]`), matching `resolveCostCapT2Usd` / `resolveCostCeilingT2Usd`.
- **Elevated only.** `cost-cap` is not in `GROUP_SCOPE_RESOURCES`, so the CLI guard denies it for any container under `cli_scope: 'group'` or `'disabled'`; only the host operator socket and a `cli_scope: 'global'` group can run it. A fleet-wide cost knob is not an ordinary coworker's to turn.
- **Effect timing.** `set` / `clear` write immediately but take effect at the next spawn (materialization is at spawn). To apply to a running session now, restart the group: `ncl groups restart --id <group-id>`.
- **Storage:** `cost_cap_policy` (central DB) — one row per scope keyed by `group_folder` (`''` = fleet). Accessors: `src/db/cost-cap-policy.ts`. Resolvers: `resolveCostCapT2Usd` / `resolveCostCeilingT2Usd` in `src/container-config.ts`.

## Floors & caveats
- **$10 minimum.** The auto-sourced cap is floored at **$10** — a brand-new group (no per-group and maybe no fleet p90 yet) still escalates somewhere sane, never at ~$0. An explicit `NANOCLAW_COST_T2_USD` override bypasses the floor.
- **The ceiling ends the session before its next turn** (turn-granularity, not mid-turn). A crossing is *detected* as soon as the message that causes it streams in, and the runner stops claiming follow-up work at that instant — but the in-flight turn is allowed to finish, because the turn's `result` (and its delivery + ack) arrives before the accounting event, and cutting the stream earlier would consume an inbound message with no answer and no retry. Per-turn overshoot is bounded by the SDK's own `maxBudgetUsd` brake, not by the ceiling. Codex spend is settled at turn boundaries too, so a turn making several codex calls can overshoot by those calls. **Continue cannot buy past the ceiling** for non-immortal groups — only a new session / `/clear` resets spend below it.
- **Immortal Tier-1 is a loose visibility threshold, not a bound.** Its cap is the per-*session* p90 applied over a per-*day* window, so it's approximate — deliberately, since immortal is never hard-stopped. The human (funding via Continue) is the real bound.
- **Turning the ceiling off doesn't auto-resume** already-stopped sessions — they clear via Continue / `/clear`, consistent with the reversible model.

## One line
> Every session is capped at **its role's own recent p90** (escalate to a human there), under a hard **$150 ceiling** that stops runaway — except the orchestrator, which only ever escalates and waits for a human to fund it.
