---
name: project_nanoclaw_1080_kb_health_route
description: "nanoclaw#1080 (szihs) adds GET /api/kb-health to dashboard/server.ts, base nv-dashboard. Reviewed INLINE at head 9a7e231e (comment 5189544063), PR OPEN. 2 🔴: a double-escaped split('\\\\n') pins driftCount at 0-or-1, and .kb-doctor.txt has NO writer anywhere so driftCount:0 means unmeasured. The PR's own stated verification is blind to both."
metadata:
  node_type: memory
  type: project
  originSessionId: kb-health-route-1080
---

# nanoclaw#1080 — `GET /api/kb-health` dashboard route

PR https://github.com/slang-coworkers/nanoclaw/pull/1080, author **szihs**, base **`nv-dashboard`**
(not `nv-main` — `dashboard/**` is EMPTY on `nv-main`, verified via `git ls-tree`; the PR's targeting
claim is exact). Head `9a7e231e306a6463cb5da67670f60df02a77204c`, **1 file +55/−0**
(`dashboard/server.ts`, route body at lines 5421–5476). My review comment **`5189544063`**.

Seventh in the KB-tooling series: [[project_nanoclaw_1066_kb_fold_bounded]] →
[[project_nanoclaw_1067_footer_normalizer]] → [[project_nanoclaw_1068_kb_health_telemetry]] →
[[project_nanoclaw_1074_scheduled_task_dump]] → [[project_nanoclaw_1076_kb_doctor]] →
[[project_nanoclaw_1078_regression_quality]] → this.

## STATE — OPEN at post time, no merge race (the FIRST in this series)

Rechecked immediately before posting per the standing rule: `state=open`, `merged=false`,
`mergeable_state=clean`, head unchanged, `dashboard/server.ts` md5 **`8fe46f9570ff58f050fae6af60f83d44`**
identical between first fetch and pre-post recheck. `ci` pass (2m34s), `label` pass — note `ci` was
**`pending`/`unstable`** on first look and went green during review, so *`unstable` on arrival is not
a finding*. **Merge-race count stays at FIVE** (#1066/#1068/#1071/#1075/#1078); this one broke the
streak but the recheck cost nothing and stays mandatory.

**Routing: handled INLINE by Main.** 5th instance of the rule — webhook again carried the generic
"route it to the project's `*-pr-approver` coworker (never a reviewer/fixer)" string, which targets
PRODUCT (slang/slangpy) PRs only. See [[project_nanoclaw_pr874_webhook_route_approver]].

## 🔴 1. `split('\\n')` — a 2-char literal, so `driftCount` is structurally 0 or 1

`server.ts:5445` reads `.split('\\n')` — **backslash, n**, not a newline. Confirmed at BYTE level
with `cat -A` on the base64-decoded head blob, so **not** a patch-render or jq-escape artifact (I
checked this specifically because the `gh api .patch` view shows the same thing and would be
suspect on its own). Census: **1** occurrence of the double-escaped form in the file, **14** of the
correct `split('\n')` — the same file's line 1577 has the right one.

Measured against `kb-doctor.py`'s REAL emit format, `f"{state:<6} {name:<14} {msg}"` (line 154) —
**not** the `DRIFT:` colon shape one would assume from reading the filter:

| input | as-written | correct |
|---|---|---|
| 3 findings, `--quiet` | **1** | 3 |
| 3 findings + header line | **0** | 3 |

Whole file collapses to one element. `--quiet` output happens to START with a `DRIFT` row ⇒ `1`
regardless of 1 or 30 findings; any leading header ⇒ **0**. `driftCount` is the field the PR body
names as most useful for regression-watching and the one the follow-up UI pill renders.

## 🔴 2. `.kb-doctor.txt` has NO writer anywhere ⇒ `driftCount: 0` means *unmeasured*

- `kb-doctor.py` is **print-only**: `grep -c "open(.*[\"']w[\"'])"` → **0**. Non-zero control:
  `kb-health.py` → **2**. It only `print()`s (line 154) and `sys.exit`s.
- Exhaustive `git grep` for `kb-doctor.txt` / `kb_doctor` across **both** `origin/nv-main` and
  `origin/nv-dashboard`, all paths → **nothing** outside `kb-doctor.py`'s own docstring. Control:
  same grep for `KB-HEALTH` finds `scripts/kb-health.py`.
- **Live prod evidence (`/workspace/shared` is mounted into this container — read it, don't infer):**
  `.kb-health.json` (7,959 B) and `KB-HEALTH.md` (1,608 B) both stamped **05:45 today**, so that
  cron IS live; `.kb-doctor.txt` **absent**; no file under `data/shared` has a line starting `DRIFT`.

⇒ On prod today the route returns `available:true` with full cost/value/shape **and**
`driftCount:0, drift:[]` — indistinguishable from measured-clean. Third-state problem, identical to
#1076's own two 🔴. Two INDEPENDENT branches: fixing the split still leaves `0` until a writer exists.

## 🟡 Smaller (all reproduced with fixtures)

- **`available:true` on a zero-transcript run.** #1068's STILL-LIVE defect propagates: I fed a
  zeroed record through this exact logic → `available:true, tokens:0, pctCiting:0`. `available` only
  means "a history record exists". Guard on `value.sessions_total > 0`.
- **`trend` mixes window sizes.** `--days` default 10 (prod history all `10`); a `--days 30` run at
  an IDENTICAL daily rate lands as `4,524,170 → 13,572,510` — a 3× sparkline step that isn't real.
  `windowDays` is already on each record; carry it per trend point.
- **Missing sub-object → a real 0.** `h.shape?.pages_over_cap ?? 0` maps *absent* to `0`; dropped
  `shape` from a record and `overCap` read `0`. `?? null` lets the chart gap.
- **No test**, where `server.test.ts` is 3,460 lines / 118 `/api/` assertions.
- **No method guard** — 22 routes pair pathname with `req.method === 'GET'`. Benign (read-only
  listener 403s non-GET before dispatch at `server.ts:5005`; interactive is `getDashboardHost()`-bound).
  Flagged for consistency, explicitly NOT as a defect.
- **No staleness signal** — `generatedAt` passed through, nothing computes age.

## ✅ Verified clean (each with a control)

Field-name contract EXACT against `kb-health.py`'s record keys (`generated_at`, `window_days`,
`cost`, `value`, `shape`, `atoms`, `top_pages`; `shape` sub-keys `concept_bytes`/`pages_over_cap`) ·
end-to-end on real prod data: `available:true`, `topPages:15`, digest 1,596 B, trend 2 entries no
nulls, response **4,999 B** · path agreement (route `getDataDir()/shared` = `resolve(data)`;
`kb-health.py` writes `<repo>/data/shared`) · "never computes inline" true (3 `readFileSync`, no
subprocess) · `requireAuth` (`server.ts:4210`) applied first · degradation holds (both artifacts
absent → `available:false`, no throw) · targeting exact.

## ⭐⭐⭐ The lesson: the stated verification was blind to BOTH 🔴

PR body verifies `GET :3838/api/kb-health → 200 {"available":false,...}` on lego. **I reproduced that
exact result — and it is precisely the case that cannot see either finding.** With no artifacts,
`available:false` and `driftCount:0` are correct FOR THE WRONG REASON; both defects require real
data to appear. Discriminating fixture = real `.kb-health.json` + a synthetic multi-line
`.kb-doctor.txt`, and it runs **offline**.

⇒ ⭐⭐⭐ **A green from an environment where the feature has no data is a green from a probe that
could not have failed** — same shape as [[command_ncl_flags_and_caps]]'s passing-control-that-could-not-fail
and [[feedback_a_guard_can_be_inert_and_read_as_passing]]. **Ask what input would have made the
author's own verification red; if the answer is "data they didn't have", their check measured
nothing.** Fourth consecutive PR in this series where READING FINDS NOTHING and running with stub
fixtures + a real run finds everything ([[feedback_control_the_instrument_not_the_reasoning]]).

⇒ ⭐⭐ **Check the escape depth at BYTE level before believing a string literal.** `.split('\\n')`
renders identically in a `gh api` patch view, in jq output, and in a quoted review — three surfaces
that could each be blamed for the extra backslash. `cat -A` on the decoded blob, plus a same-file
census of the correct form (1 vs 14), is what makes it a finding rather than a suspicion.

RESUME = **szihs responds to `5189544063`** ⇒ open the follow-up (split fix · drift third-state ·
`windowDays` per trend point · `?? null` for absent sub-objects · fixture tests). Nothing is live
yet (PR unmerged), so unlike #1066/#1068/#1071/#1075/#1078 there is **no regression on a branch to
chase** — this one is a real pre-merge gate. #1066's `superseded_by` and #1068's two defects remain
owed follow-ups on `nv-main`.
