---
type: runbook
description: Pull-stage pitfalls of the /supervise-issues tick — cache-key comparison, GraphQL batch stripping, lo-cache build, dead predecessor ticks, --state handling.
---

Pull- and cache-stage traps for the tick pipeline. Parent: [[orchestrator/supervise-tick-pull-pitfalls.md]].

- **Cache keys must compare SORTED session lists.** Stored lists are in pull order; comparing to `sorted(...)` misses
  almost every chain. Bit `refetch_lo.py` (tick 269: 530 re-fetches instead of 27) and `pull.sh:594` (tick 271: timed
  out at 1800/1876). Both fixed (`sorted(x or [])`) and carried in the copied helpers. If a pull is <50% after 5 min,
  check the cache hit rate before waiting it out.
- **`pull.sh` can drop last-outbound** (tick 267: `None` for 31 of 53 re-fetched chains) — runbook step 3 repairs it.
  `refetch_lo.py` / `refetch_none.py` crash at the final `json.dump` without an output arg (tick 284).
- **A GraphQL 5xx silently strips a repo batch.** `pull.err` showing `HTTP 504` → `graphql fallback for <repo> batch N`
  left `pr`/`comments` empty on 50 rhi chains (tick 278: 2 false nudges + 3 false escalations). Grep `pull.err` for
  `HTTP 5`/`fallback` and compare per-repo `with pr`/`with comments` counts against the previous payload3. Fix: confirm
  nothing moved (`gh api repos/<o>/<r>/issues?state=all&since=<prev tick>`), carry the previous fields forward for that
  repo (`payload3r.json`), re-scan. Compare `pr` counts against the previous **payload1** (prfix/botbind add ~20 PRs in payload3), and find the stripped set as chains whose previous payload1 had comments/pr and this one has none (tick 326: 41 contiguous #12909–#12962; carried pr/comments/our_last_push/issue_open, re-fetched the 1 that moved).
- **Tick 385: a list-index guess at `payload3.json['chains']` yields a 0-chain lo-cache SILENTLY** — print the chain count right after building lo-cache to catch it (the dict-keyed shape is documented above, tick 324).

- **Build `lo-cache.json`/`prev-la.json` before launching `run-pull.sh`** — they are not among the copied helpers; a missing
  `lo-cache.json` makes `pull.sh` die at its line-83 `open()` after the cost-cap stamp (~1 min lost, tick 333).
- **`payload3.json` `chains` is a dict keyed by thread** (no `key` field; `sessions` is a list of ids) — build `lo-cache.json` as `{thread:{ts:our_last_outbound,text:last_outbound_text,sess:sessions}}`. Include **every** chain, also those with `ts: null` — `pull.sh:594` reuses an entry only on a key hit, so dropping the null ones turns ~1,300 chains into `ncl` cache misses (tick 324 caught it before launch).
- **The mid-tick `ncl sessions list` re-list can come back empty** (0-byte stdout, exit 0) — `moved.py` then dies on `json.load`. Retry until the file is non-empty (tick 307).
- **`ncl sessions messages` truncates every row to 300 chars unless `--full` is passed** — hold reasons and operator asks get cut mid-sentence. `tick305/msgs.py` passes `--full`. Any `ncl` call made while `pull.sh` is running fails with `database is locked`; do GitHub-only checks (auto-merge sweep, closed-since) during the pull instead (tick 305).
- **Relayed posts in the dashboard session are stored cut to ~500 chars even with `--full`** (tick 319: the 08:44Z maintainer relay ended mid-sentence). Find the sending Main session by `last_active` near the post time and read its own `out` row with `--full`.

- **A predecessor tick that died mid-pull (tick 354: 0-byte payload1, session death 12:06Z) does not corrupt the next tick** — `memory/supervisor-state.json` stays at the last COMPLETED tick's final state, which is exactly the right pre-tick snapshot. Build `lo-cache.json` from the last completed tick's `payload3.json` (tick 353's, not the dead tick's), and `prev-la.json` from the dead tick's `sessions.json` if it got that far (fresher). Check the previous tick dir for `pull.done`/nonzero `payload1.json` before trusting it (tick 355).
- **If `pull.sh` ran with the `--state` file missing (tick 355: a `cp` landed in the default cwd), the payload comes back with `state: {}` and no disposition rehydration — do NOT re-pull.** The state file's only two uses in pull.sh are the `payload['state']` key and per-chain `disposition` rehydration (pull.sh ~line 606). Post-hoc: inject the pre-tick state into `payload['state']` and copy each chain's `disposition` from it, then continue the pipeline. Verify the save with 0 dropped keys vs pre-tick (the usual guard still applies).
