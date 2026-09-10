---
name: project_nanoclaw_1124_kb_unknown_not_clean
description: "nanoclaw#1124 (szihs) — kb-doctor/kb-health three-state fix; the follow-up to MY #1076/#1080 findings. MERGED 9min after opening, reviewed post-merge (comment 5205790123). Body's claims all VERIFIED by execution. 3 🔴 remain, all the same shape as the bug it fixes: a CLEAN run whose artifact write fails prints CLEAN on stdout + leaves a stale clean artifact; check_tasks iterates snapshot keys only so live-only field/task are invisible; check_branch can't tell current from never-refetched."
metadata:
  node_type: memory
  type: project
  originSessionId: f93f8d1a-1bd8-4081-9d36-072862cd05d2
---

# nanoclaw#1124 — "unknown is not clean, and never overwrite the trend"

`slang-coworkers/nanoclaw#1124`, author **szihs**, branch `fix/nv-main/kb-observability` → `nv-main`,
head `18d7d23dcf706ef2b47d8c2b36ccdfd76eb97044`. **3 files, +791/−97**: `scripts/kb-doctor.py`
(+286/−79), `scripts/kb-health.py` (+102/−18), NEW `scripts/test_kb_observability.py` (+403).
All three checks green (`ci` 2m47s, `check`, `label`). My comment **`5205790123`**.

**This PR is the fix for findings I filed on [[project_nanoclaw_1076_kb_doctor]] (the third-state ask)
and [[project_nanoclaw_1080_kb_health_route]] / [[project_nanoclaw_1068_kb_health_telemetry]].**
Eighth in the KB-tooling series.

## MERGE RACE — 6th instance, and the tightest-but-one

Opened `13:49:38Z`, **merged `13:58:34Z`** by szihs (`f73e4d0d`) — **9 minutes**, while I was
mid-probe. State at first fetch was `open/clean`; the recheck immediately before posting caught it.
⭐⭐**The recheck is what turned "pre-merge advisory" into "these are live on nv-main"** — the framing
of the whole comment depended on one API call costing nothing.

**Blob identity verified by hash, not diff-read** (per the standing rule): reviewed head vs
`origin/nv-main` → `kb-doctor.py c5904ed1e7a420295c549a48c5c7a90b76895154`,
`kb-health.py 69d41049851b0866b68a2f9a8f45050c9526da8b`,
`test_kb_observability.py b32d8b2c67259d2b5beaa0fbd1615c0b060485b8`, all **IDENTICAL** ⇒ every
finding is live. Merge-race tally in this series: #1066 (26s), #1068 (104s), #1071, #1075, #1078,
this (9m). **Post-merge review is the DEFAULT posture for szihs + nv-main.**

**Routing: INLINE by Main — 6th instance of the standing rule.** Webhook again carried the generic
post-#874 *"Route it to the project's `*-pr-approver`"* string. See
[[project_nanoclaw_pr874_webhook_route_approver]].

## ⭐⭐⭐ What was DIFFERENT this time: the body's claims survived testing

Unlike every prior PR in this series, **every testable claim in the body verified**. Probes each
paired with a control that could return the other answer:

- `atoms/day` — 3 atoms / 3 active days in a 14d window → **0.2** as claimed (control: 14/14 → 1.0).
- `admits()` superset of `CITE_RE` — 0 violations; **negative control** `admits("no dot m d here")`
  → False, so the filter isn't trivially true. The test pins the *property*, not an example.
- Envelope classification (the trap szihs found in his own patch): `forbidden` whose message says
  "task not found" → UNKNOWN ✅ · `handler-error`+"not found" → DRIFT ✅ · `exit 127 /
  exec: pnpm: not found` → UNKNOWN ✅.
- Refusals (0 transcripts, corrupt history), `.corrupt.<ts>` preservation, temp+fsync+rename,
  `--quiet` always emitting a summary: all reproduce.

Consumer half on `nv-dashboard` reads `.kb-doctor.json`, gates `schema !== 1`, takes `driftCount`
from `counts.drift` with `null` for unavailable, `DOCTOR_STALE_HOURS = 36` ⇒ **both my #1080 🔴 are
fixed there.** The `.kb-doctor.txt` fallback is deliberately absent, with a comment saying why.

## 🔴 1. A CLEAN run whose artifact write fails prints `CLEAN` and leaves a stale clean artifact

`code = max(code, 2)` handles the exit code, but the message is **stderr-only** and the summary line
derives from `status`, which the failure never touches:
```
kb-doctor: CLEAN — 4 ok, 0 drift, 0 unknown (exit 2)     ← stdout, stderr dropped
```
Artifact on disk keeps the **previous** run's `status: clean, complete: true` — `generatedAt`
confirmed unchanged after the failed write. Inside the 36h staleness window a consumer reads a
confident clean report reflecting no run. ⭐⭐**This is the PR's own thesis violated in the one path
it added**: the write failure IS "could not run", and it renders as CLEAN.

Also: `DRIFT` + failed write exits **2**, not 1 — `max(code, 2)` overrides the documented "DRIFT
outranks UNKNOWN". stdout says DRIFT ⇒ a caller keying on exit code and one reading stdout disagree.

## 🔴 2. `check_tasks` compares snapshot→live only

`differing = sorted(k for k in want_cmp if want_cmp[k] != live_cmp.get(k))` iterates **snapshot**
keys; `live_cmp` is filtered by `k in want_cmp`. A live-only key cannot appear.

| fixture | result | should be |
|---|---|---|
| live gains gate `script`, snapshot lacks the key | **OK** | DRIFT |
| snapshot `script: null`, live has script | DRIFT `[script]` ✅ | DRIFT |
| `recurrence` changed on an existing key | DRIFT `[recurrence]` ✅ | DRIFT |

**Latent today** — real snapshot has uniform keys across all 13 tasks (`script` on all, `null` on 7).
Same root the other way: kb-doctor never enumerates the live set (`grep -c '"tasks","list"'` → **0**;
dumper → **1**) ⇒ an undumped production task reports OK.

## 🔴 3. `check_branch` can't tell "current" from "never re-fetched"

Compares the *local* `origin/nv-main` ref, never fetches. Stale ref equal to HEAD → `OK ... current`.
Control (ref genuinely ahead) → `DRIFT ... behind by 1 commit(s)`. The UNKNOWN path fires only when
the ref is **missing** ("not fetched?"), never when merely old — and a long-lived prod checkout is
where a stale ref lives. `grep -n fetch` → 2 hits, **both prose**.

## 🟡 4 + carried-over

- **Second snapshot silently unchecked**: `snap = snaps[0]`, rest dropped with no finding. Probe: 2
  snapshots, the drifted one ignored → OK; control (delete the clean one) → DRIFT. `INSTANCE_SLUG`
  (`dump-scheduled-tasks.py:149`) makes a 2nd instance natural.
- **Producer's `complete`/`listed_count` unread**: `complete:false, listed_count:13, task_count:1`
  → OK. `grep -n complete kb-doctor.py` → only its own output field. ⭐It **imports** `VOLATILE`
  from the dumper to avoid disagreeing about what a definition is — the same argument covers the
  dumper's completeness claim.
- **`trend` mixes window sizes** (from #1068, unfixed): `--days 30` vs a `--days 10` prior at an
  identical rate → `(-100% vs prev)` / `(+100% vs prev)`. Live history uniformly `10` ⇒ latent.
- **`other` layer in `tokens_total`, absent from the printed breakdown**: live **14,277 / 5,580,509
  = 0.3%** unattributed.

## Cron — unverifiable from here too, and the body says so

`crontab: command not found` in my container; `git grep` finds no in-repo caller (`funnel-cron.sh`
mentions the kb-health cron in a **comment** only). ⭐⭐**The body has a "What I could NOT verify"
section naming exactly this, and it was right** — I reached the same negative by a different route.
Finding 1 makes it worse than the body assumed: a masked exit code also costs the stdout signal.

## ⭐⭐⭐ The lesson

Every finding is a place the **new UNKNOWN state isn't reached** — not a place the design is wrong.
⇒ ⭐⭐⭐ **Adding a third state fixes only the paths that route into it. The audit for "unknown is not
clean" is not "does UNKNOWN exist" but "enumerate every way this can fail to run, and check each
one reaches it"** — here the artifact write, the reverse-direction key comparison, the stale ref,
and the extra snapshot all bypassed it. Same family as
[[feedback_a_guard_can_be_inert_and_read_as_passing]] and
[[feedback_control_the_instrument_not_the_reasoning]]; **fifth consecutive PR in this series where
reading finds nothing and running with fixtures finds everything.**

Write path unchanged (4th confirmation): `gh api repos/.../issues/1124/comments --method POST
--input <json>`, payload via `json.dump`. `gh pr review` / `gh pr comment` remain denied.

**RESUME** = szihs replies to `5205790123` ⇒ open the follow-up. Fix set: (a) `status:"unknown"` +
an `artifact` finding on write failure and fix exit-code precedence, (b) snapshot↔live key symmetry,
(c) enumerate the live set via `tasks list`, (d) ref staleness → UNKNOWN, (e) multi-snapshot guard,
(f) honour `complete`/`listed_count`, (g) `window_days` in `d()`, (h) print `other`.
⚠️**All 3 🔴 are LIVE on `nv-main`** (blob-hash verified) — unlike #1080, this is a regression to
chase, not a pre-merge gate.
