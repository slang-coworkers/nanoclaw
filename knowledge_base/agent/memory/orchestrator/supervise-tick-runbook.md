---
type: runbook
description: Fast path for a /supervise-issues tick — read FIRST, before SKILL.md. Use the cached tickNNN/pull.sh (never the stock pull-universe.sh), the helper pipeline, and the pull/cache pitfalls that keep the payload honest. Split 2026-10-13; false-positive and blind-spot catalogues live in sibling pages.
---

# /supervise-issues tick runbook (learned ticks 255–284)

**This runbook overrides SKILL.md's "use `scripts/pull-universe.sh` (preferred)".** Never launch the stock
script: its step 1b calls `ncl cost-cap status` once per gh-issue session (~1.2–2 s × ~4,100 sessions ≈ 80 min–2.4 h),
and it has no outbound cache. Ticks 257, 272, 273 and 274 each lost 4–35 min by starting there (274 because this page
was only linked from the orchestrator index — hence the Core Memory pointer). A one-call `cost-cap stopped` patch
without the outbound cache (`tick274/pull-universe-fast.sh`) still took 53 min. The cached `tickNNN/pull.sh` takes ~4–6 min.
A clean tick runs ~20–30 min end to end.

Companion pages: [[orchestrator/supervise-tick-false-positives.md]] (rows scan flags that aren't real) and
[[orchestrator/supervise-tick-blind-spots.md]] (real stalls scan misses). Delivery rule:
[[project_supervise_tick_no_cc_discord.md]].

## Fast path

1. New `tickNNN/` dir. Fetch inputs once, **serially** (concurrent `ncl` → "database is locked"):
   `ncl sessions list --limit 10000 --json > sessions.json`, `ncl groups list --json > groups.json`,
   `ncl cost-cap stopped --json > stopped.json`.
2. Copy helpers from the latest tick dir (**latest: `/workspace/agent/tick288/`**) and `sed` every `tickNNN` path.
   `board274.py` hardcodes `supervisor-state.pre-tickNNN.json`; repoint `titles.py` to payload5.json.
   Build `lo-cache.json` from the **previous `payload3.json`** (not payload1, so last tick's re-fetch fixes carry
   forward) and `prev-la.json` from the previous `sessions.json`. Run `pull.sh` with env
   `SESSIONS_FILE GROUPS_FILE STOPPED_FILE LO_CACHE PREV_LA` and args `--state supervisor-state.pre-tickNNN.json --include-closed > payload1.json 2> pull.err`
   (lo-cache = `{key:{ts,text,sess}}` from prev payload3 chains; prev-la = `{sid:last_active}` from prev `sessions2.json`); it reuses `our_last_outbound`/`last_outbound_text` for any
   chain whose session set and per-session `last_active` are unchanged (typically ~15 of ~4,200 sessions change).
   Its cost result uses the dashboard's own predicate, so it is exact.
3. On payload1: `refetch_lo.py` + `refetch_none.py` (retrying, 90 s timeout), then normalize naive
   `YYYY-MM-DD HH:MM:SS` stamps to ISO `Z`.
4. `prfix.py payload1.json payload2.json` (live `fix/issue-N` PR over a CLOSED first cross-ref) →
   `botprs.py` + **`botbind.py payload2.json payload2b.json`** (bind via closingIssuesReferences; not optional — without
   it `dev/slangpy-fixer/*` and reused `fix/issue-<other>` branches read as fixer-owned with no PR) →
   `apply_disp.py payload2b.json payload3.json` (verified dispositions from `disp-overrides.json`; it must NOT create
   state keys for chains that have none, or new chains lose their 🆕 delta) → `scan.py`. With empty overrides,
   `payload5 = payload3` and `scan-out3 = scan-out1`; the renderer reads both names.
5. In parallel: `runs.py` → `ci.py` (CI cells) and `titles.py`; `gc_resolve.py` → `worktree-gc.py`. **Launch them with
   Bash `run_in_background: true`, not `( … ) &` inside a foreground call** — tick 282's `&`-detached runs/ci/titles died
   with that call's shell (no `ci.json`/`titles.json`, ~10 min lost); gc survived only by luck. scan.py and
   worktree-gc.py live at `/home/node/.claude/skills/supervise-issues/scripts/` (scan reads stdin: `scan.py < payload3.json`).
6. Re-list sessions just before the final scan (a chain can get its first session mid-tick, e.g. #13469/#13470).
   Verify **every** `action=nudge`/`escalate` row against GitHub and transcripts; record a disposition for each false
   positive (tokens scan.py recognizes are `advisory:…`; re-tokenize `watch:`/`handed-off:`), then re-run scan so state
   persists.
6b. **Auto-merge sweep (every tick):** list open PRs with `auto_merge` armed and check `mergeable_state` — an approved
   bot PR that's `dirty`/`behind` never merges and scan can't see it ([[orchestrator/supervise-tick-blind-spots.md]] shape 7).
7. Render with `board274.py` (notes.json / nudged.json / real-updates.json / art-override.json). Write `notes.json` and
   `real-updates.json` for every 🔼 row after checking GitHub. Strip dashboard deep-links from the inline chat board to
   stay under ~16 KB; the tracker file keeps them.

## Delivery and turn discipline

- **Send the board mid-turn with `send_message(to="orchestrator-dashboard")`.** A final-response `<message>` block from
  the cron session came back `undelivered_message` (tick 272).
- **Never end the turn while the pull is running.** A cron session that yields has no follow-up turn (tick 259 never
  posted or wrote state; caught when `_meta.tick` was still stale). Wait in-turn with a foreground
  `until [ -f pull.done ]` loop (≤10 min per call).
- **Nudges:** a thread-keyed `send_message` can be refused ("without in_reply_to … has received messages on it"). Pin
  `target_session_id=<owning session>` instead, then read the recipient's rows to confirm the `direction=in` landed.
  Re-read the issue's comments immediately before sending — a triager that posts after the pull reads as `silent`
  (the #13555 nudge landed 9 min after the triage comment).
- When a closed chain still has a recurring resume trigger (e.g. `recheck-slang-<n>`), pause it.

## Pull / cache pitfalls

- **Cache keys must compare SORTED session lists.** Stored lists are in pull order; comparing to `sorted(...)` misses
  almost every chain. Bit `refetch_lo.py` (tick 269: 530 re-fetches instead of 27) and `pull.sh:594` (tick 271: timed
  out at 1800/1876). Both fixed (`sorted(x or [])`) and carried in the copied helpers. If a pull is <50% after 5 min,
  check the cache hit rate before waiting it out.
- **`pull.sh` can drop last-outbound** (tick 267: `None` for 31 of 53 re-fetched chains) — that's what step 3 repairs.
- **A GraphQL 5xx silently strips a repo batch.** `pull.err` showing `HTTP 504` → `graphql fallback for <repo> batch N`
  left `pr`/`comments` empty on 50 rhi chains (tick 278: 2 false nudges + 3 false escalations). Grep `pull.err` for
  `HTTP 5`/`fallback` and compare per-repo `with pr`/`with comments` counts against the previous payload3. Fix: confirm
  nothing moved (`gh api repos/<o>/<r>/issues?state=all&since=<prev tick>`), carry the previous fields forward for that
  repo (`payload3r.json`), re-scan.
- **scan's `delta=updated` overcounts** when a cache refresh moves stamps backwards (tick 269: 59 raw → 20 real). Filter
  real updates by activity after the previous pull's start (`real-why.json`). It can also be entirely real (tick 276).
- **`ci.py` merge=UNKNOWN is GitHub computing mergeStateStatus lazily**, not a change (tick 278: 207 rows flipped, ⤵️
  dropped). When the run id is unchanged, carry the prior cell and merge state.
- **A tracked CI run can 404** (GitHub purged runs created ~10-01T20:05Z→10-07T22:25Z; 30 open PR heads had 0 check
  suites as of 10-12). `ci.py` then falls back to an older cancelled run → `❌(recheck)`. Check the PR's
  `statusCheckRollup` is empty before treating it as a rebase-nudge case.
- **`refetch_lo.py` / `refetch_none.py` need an output arg** (`refetch_lo.py payload1.json payload1b.json`, then
  `refetch_none.py payload1b.json payload1c.json`); with one arg they crash at the final `json.dump` (tick 284).
- **Merge state must be carried key-by-key:** scan's `state` drops closed chains, so after writing it back, re-add
  every pre-tick key the scan omitted (tick 284: 9 closed keys would have been lost).
- **`gh api rate_limit` → OneCLI `app_not_connected` is not an outage.** Probe with `gh api -i repos/shader-slang/slang`
  (`X-Ratelimit-Limit: 6000`) + `gh api graphql -f query='{viewer{login}}'` before reporting auth trouble (tick 284).
- **Merge-queue eviction is a blind spot (shape 8):** an approved bot PR the queue evicted (`removed_from_merge_queue` in
  the issue timeline) sits `BLOCKED` with green PR CI and no auto-merge. The bot can't enqueue, so it goes on the board
  as an operator call. Check the timeline of each approved bot PR that is still open (#13171, tick 284).
- **Worktree GC:** build `wt-dirs.txt` with `find /workspace/extra/ephemeral/prod-groups -maxdepth 3 -mindepth 3 -name .git -type f` (worktrees sit at `prod-groups/<folder>/<wt>/.git`; `-maxdepth 2` finds 0 — tick 280). `worktree-gc.py` reads **stdin only** (`--in` is ignored; it hangs). Build the GC payload from
  `wt-resolved.json`'s `path` field, not `dir` (the basename — every size lookup missed). Filter `wt-dirs.txt` to drop
  submodule `.git` files (gitdir containing `/modules/`). Common REAP shape: merged-PR reviewer worktrees
  (`wt-<pr>-verify/-revA/-base/-master`), owned by the reviewer session on the chain whose `pr.number` matches (or the
  `slang-ci-nightly-*` thread for nightly-PR chains).
- **Verify `ci.done` + `ci.json` exist before rendering.** Tick 286's backgrounded `ci.py; titles.py` pair finished
  titles but left an empty `ci.log` and no `ci.done`/`ci.json`; a standalone re-run took ~2 min.
- **Auto-merge sweep / closed-since without GraphQL search:** the org-wide GraphQL `search` 502s intermittently; use
  REST `repos/shader-slang/<r>/pulls?state=open&per_page=100&page=N` filtered on `.auto_merge!=null` (3 pages × 3 repos),
  and `gh search issues --owner shader-slang --closed '>=<date>' --include-prs` (raw `gh api search/issues?q=…closed:>=`
  returns empty JSON).
- The board quotes `[Resolution]` from status text, which trips the codex-gate audit line; benign here.

## Degraded tick: shader-slang credential 401 (tick 285, 2026-10-16)

- **Probe before pulling:** `gh api -i repos/shader-slang/slang`. If you get a 401 "Bad credentials" while `repos/slang-coworkers/nanoclaw` returns 200, the shader-slang credential is dead and no GraphQL pull can run. Escalate to the dashboard (failing step + exact error) first.
- **Degraded path:** derive the chain universe from `ncl sessions`, then find the moved threads by diffing per-session `last_active` against the previous tick's `sessions.json`. Read the newest rows of each moved chain with `ncl sessions messages`. For GitHub state, use **unauthenticated** public REST (`curl --noproxy '*'`, 60/h). That budget covers ~45 issues, ~11 PRs, a 5-page auto-merge sweep and one `search/issues?q=org:shader-slang is:closed closed:>=<prev tick>`. Label the CI column n/a and journal the new keys by hand. Set `_meta.degraded=true` so the next tick knows to run the full cached pull.
- **Hold nudges during the outage.** A nudged coworker can't post either, so the nudge only produces a second stall.
- A cron fire whose pull died mid-run (tick 285: 900/1965 after GraphQL TLS timeouts) leaves an empty `payload1.json`. The next batched turn has to finish that tick, not skip it.

## Degraded tick: `ncl` congestion (tick 287, 2026-10-16)

- **Symptom:** about half of all `ncl` calls hit the 30 s client timeout, so the cached pull crawls through its cache misses (each one a 30 s `ncl sessions messages`). Tick 287 lost 40 min: it reached 1560/1977, and the job was killed at the 40-min background cap. `payload1.json` is written only at the very end, so that work was gone.
- **Probe first:** time one `ncl sessions get <sid>`. If it takes >10 s or times out, don't run the stock cached pull.
- **Fix:** `tick287/pull-nocl.sh` with `NO_NCL=1`. A cache miss takes the previous lo-cache value and gets marked `lo_stale`. The GraphQL part then finishes in ~10 min. Next, verify each flagged row by hand: retry `ncl sessions messages`, since roughly 1 in 2 calls succeed. Use `.claude-trace/session-<sid>.jsonl` `request.timestamp` to see whether a session is live. Also use worktree mtimes.
- **Don't `pkill -f <script>`** from a shell whose command line contains that name: it kills the relaunch too. Don't `sed 's/miss.json/miss2.json/'` either: the `.` matches, and the rewrite corrupts `json.load(open('miss.json'))`.
- A fleet restart (127 sessions with `last_active` 11:31:14Z) moves `last_active` with no new rows. Those sessions are cache misses with nothing new in them, so `NO_NCL` loses little on them.

## Tick 288 notes (2026-10-17, clean run ~30 min)

- **New-chain diff must union `_archived`.** State has ~830 top-level keys plus ~1,260 in `_archived`; diffing threads
  against top-level keys alone reports ~1,250 false "new" chains. Sub-thread sessions (`…-<n>/<suffix>`) need a
  `subthread:` journal entry by hand — scan never creates one.
- **Draft bot-PR CI is deadlocked, not slow.** `ci-retry-yielded-bot` (the real name; `retry-yielded-bot-ci.yml`
  matches nothing) logged "CI is still active (91–107 runs)" on 98 of 100 fires since 10-15, because ~88 runs sit
  `waiting` on `falcor-build-approval-gate`. A fixer holding its Fix Report "until the retry re-runs CI" waits forever,
  and scan reads it as `awaiting_human` (#13716). Classify the helper's decision lines (`gh run view <id> --log`)
  before trusting a ⏸️ yield to self-heal.
- **`ncl sessions messages --reverse` orders by seq, so a fresh nudge can be invisible** (it took seq 10 below seq 17).
  Confirm landing by `last_active` moving, or sort the rows by `timestamp`.
- `gh` CLI `sleep N; cmd` chains are blocked by the harness; just run the check.
