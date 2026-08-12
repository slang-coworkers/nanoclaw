---
name: project_nanoclaw_1187_grafana_stack_into_git
description: "nanoclaw#1187 (szihs) ops/ Grafana stack into git — reviewed INLINE at head 594996e9 after a ruff-fix synchronize, comment 5250247725. 2🔴: heartbeat watchdog emitted from INSIDE the section most likely to die; winRate lands as an INTEGER field at 0/1 => whole-POINT drop, shard-scoped so intermittent. Path-guard passes ops/README.md by depth-accident (3 of 1046 files so owned; sibling allowlists have 0 bare patterns)."
metadata:
  node_type: memory
  type: project
  originSessionId: 62d302da-c9ae-40de-ae7f-698f5b755918
---

# nanoclaw#1187 — "put the Grafana stack in git; stop it reporting stale numbers as current"

PR https://github.com/slang-coworkers/nanoclaw/pull/1187, author **szihs**, base **`nv-main`**,
4 files **+3365 −0** (all new: `ops/README.md`, `ops/grafana/nanoclaw-coworkers.json`,
`ops/metrics/nanoclaw-metrics.py`, `ops/metrics/nanoclaw-metrics.service`).
My comment **`5250247725`** posted 07:25:34Z.

**Routing: INLINE by Main (~31st instance).** Generic `pr_ready_for_review` *"route to the
project's `*-pr-approver`"* string again; nanoclaw is platform-infra with **no approver wired**
and the slang/slangpy approvers are scoped to compiler-CODE PRs.
[[project_nanoclaw_pr874_webhook_route_approver]], same as #1182/#1183/#1185.

## Two heads — the synchronize arrived MID-REVIEW

Reviewed `2f032ac9` first; a `synchronize` webhook landed while I was measuring, head →
**`594996e9`** ("ops: satisfy the ruff gate"). **Blob-identity check is what made the re-review
cheap:** `README.md` / dashboard JSON / `.service` **identical by hash** across both heads
(`8b08a9f6`, `aefb50b7`, `09c776e4`), only the collector changed (`dd93bd2b` → `bd51ced0`).
⇒ dashboard + README findings carried without re-derivation; only the collector's two findings
needed re-running. Both reproduced at the new blob.

The new commit is a genuine ruff fix: `%`-format → f-strings, 6× `# noqa: BLE001` **with a
reason at each call site** (what `ruff.toml` demands), mode `100644` → `100755` for `EXE001`.
✅ Reproduced `ruff==0.16.2` + repo `ruff.toml` (`target-version = "py39"`) on the new blob:
**All checks passed**; CI agreed (`ci` green at `594996e9`). Old head had exactly **17**
findings (10 UP031, 6 BLE001, 1 EXE001) — my local run matched CI's list item-for-item.

## 🔴 1 — The watchdog is emitted from inside the section most likely to die

`heartbeat_unixtime` is set in `collect_db()` and shipped by that function's single trailing
`emit("nanoclaw_fleet", fleet)`. `main()` wraps each section in `except Exception` and
continues. So **any** earlier throw in `collect_db` skips the emit entirely.

✅ **Proved by execution** (synthetic v2.db with `hook_events` absent — one plausible schema
drift): `nanoclaw_webhook` / `nanoclaw_errors` / `nanoclaw_funnel` / `nanoclaw_health` all still
emitted, `nanoclaw_collector detail="db:no such table: hook_events" errors=1i`, and
**`heartbeat_unixtime` lines: 0**. The watchdog is the ONLY thing that went silent while every
other panel kept looking current — the inverse of what its own panel description promises
(*"if this stops advancing, DISTRUST EVERY OTHER PANEL HERE"*).

⭐⭐ **The PR's own thesis one level up:** *"a metric that stops being collected must look
different from a metric that is genuinely zero"* — and the watchdog is the metric least
protected from stopping.

⭐⭐⭐ **I caught my own fix suggestion being wrong before shipping it.** First draft said
"emit it from `main()`". Tested it: two `emit("nanoclaw_fleet", …)` calls produce two lines with
the **same measurement, no tags, no explicit timestamp** ⇒ same series+ingest-time ⇒ one
**silently overwrites** the other. Corrected the advice to put it on `nanoclaw_collector`
(already emits unconditionally from `main()`). **A fix suggestion is a claim and needs the same
execution check as a finding.**

## 🔴 2 — `winRate` becomes an INTEGER field at exactly 0 and 1

`emit()` branches on Python type: `isinstance(v, int)` → `=0i` (Influx integer),
`isinstance(v, float)` → `=0.519637`. `scripts/funnel.ts:731` computes `merged / total`;
`JSON.stringify` writes `0`/`1` with no decimal point ⇒ `json.load()` returns a Python **int**
for precisely the two boundary values. Measured at the new head:

```
json 0          (int)   -> issuePartition_winRate=0i        <- INTEGER field
json 1          (int)   -> issuePartition_winRate=1i        <- INTEGER field
json 0.519637   (float) -> issuePartition_winRate=0.519637
json 0.0        (float) -> issuePartition_winRate=0
```

⭐⭐⭐ **Delegated doc verification returned TWO corrections that made the finding STRONGER than
the version I was about to post** — I had it as "the field is dropped":

1. **The unit of rejection is the whole POINT, not the field.** `HTTP 400`,
   `partial write: field type conflict: … dropped=1`; docs say the system "does not write the
   point". ⇒ a `winRate` of 0 or 1 takes **every other `nanoclaw_funnel` field on that line**
   with it (`age_sec`, all `weekly_*`), so "Funnel snapshot age" freezes too and its `last()`
   serves a plausible-looking stale age.
2. **The conflict is SHARD-scoped, not measurement-global** — *"a field's type cannot differ in
   a shard, but can differ across shards"*. With the 7-day default shard group duration, `0i` is
   rejected inside the current shard but **silently accepted** once a boundary is crossed,
   leaving one field key with two types. ⇒ **the bug reproduces only some of the time**, which
   is the hardest version to diagnose from a dashboard.

⇒ this is the *same shape* as the eight-day bug the PR fixes: `winRate` was `0` (int, accepted,
written) right up until it turned fractional. Fix: `return float(x)` in `_num()` — coerce at the
boundary so a field's Influx type cannot depend on its value. Same exposure on
`weekly[].winRate` / `rollingWinRate` via the dict branch.

## 🟠 3 — `.service` invokes a script the PR does not ship

`ExecStart=/usr/local/bin/nanoclaw-metrics-push.sh` + `EnvironmentFile=/etc/nanoclaw-metrics.env`
— **neither is in the tree**, and `README.md`'s own diagram draws the push script as the
InfluxDB hop. Also `Type=oneshot` with **no `.timer`** in the tree though the README says "every
60s". ⇒ the stated goal (*"makes it reproducible rather than box-local"*) is 3 of 5 moving parts;
the two carrying the connection details (`db=lp`, the URL) are still box-local.

## 🟡 4–6

- **`fill(previous)` contradicts the PR's own gap rule.** Census over all targets:
  `fill(previous)` **×17**, no-clause ×18, `fill(0)` ×8, `fill(null)` ×3, **`fill(none)` ×3** —
  and `fill(none)` is only on the three NEW timeseries. Docs: `fill(previous)` "reports the
  value from the previous time interval"; Grafana `spanNulls` defaults false ⇒ absent renders as
  a break. So `fill(previous)` **manufactures** a value that `noValue` can never catch. The 14
  `fill(previous)` **stat** panels are the worse form (one big number, no shape to reveal
  staleness). Nuance in its favour: it "doesn't fill … if the previous value is outside the
  query's time range", so the left edge of the 6h window still gaps.
- **"Approval decisions (24h)" reads the `_all` fields.** ✅ Proved with a 1-in-window /
  2-out-of-window fixture: `would_approve=1i, would_approve_all=2i` — the panel's four targets
  are all `*_all`, built from a query with **no `decided_at` filter**. The retitle moved the
  label away from the data. (`window_hours=24i` is emitted and could carry the label.)
- **`%g` truncates to 6 sig-figs** — `1786429119.7 → 1.78643e+09`, round-trips to
  `1786430000.0` (880s drift). Latent, not live: no current float field is that large, but
  `_num()` now admits any float the producer adds.

## ⭐⭐⭐ The path-guard finding — the guard authorizes changes, so its own defect matters most

`check` red at BOTH heads: 3 of 4 files outside `nv-main`'s allowlist. But running the repo's
**own** matcher (`.github/nv-path-guard/ownership.py`, git-engine in an isolated repo) shows
**`ops/README.md` passes by DEPTH-ACCIDENT** — the bare pattern `README.md` has no slash, so
gitwildmatch matches it at any depth.

Sized against the real tree: **1046** tracked files, 1026 owned, **32 owned only via a bare
pattern, of which 3 are not at repo root** ⇒ `ops/README.md`, `container/CLAUDE.md`,
`templates/README.md`. **29 of 117** patterns in `nv-main.txt` are slashless and it has **zero**
rooted (`/`-prefixed) patterns; `nv-dashboard` / `nv-slang` / `nv-slangpy` / `nv-nanoclaw` have
**0** slashless patterns each. ⇒ a drafting inconsistency in ONE allowlist, not a convention.

⇒ practical consequence: whichever way #1187 resolves, 3 files get an explicit ownership
decision and the 4th slips through unreviewed on a pattern written for the root `README.md`.

## Links

[[feedback_a_fix_suggestion_is_a_claim_needing_its_own_execution_check]],
[[feedback_blob_identity_across_heads_scopes_a_re_review]],
[[project_nanoclaw_1182_guard_covers_appends_not_innerhtml]],
[[project_nanoclaw_1183_error_dict_not_raise]],
[[project_nanoclaw_1185_sync_onshutdown_breaking]]
