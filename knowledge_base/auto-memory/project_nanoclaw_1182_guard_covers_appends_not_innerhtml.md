---
name: project_nanoclaw_1182_guard_covers_appends_not_innerhtml
description: "nanoclaw#1182 (szihs) unit-cost folder match + funnel generation guard — MERGED 3m22s after opening, blobs == MERGE COMMIT 01ed25f2 BY HASH. Reviewed INLINE, comment 5241807730. 2🔴: guard skips the one block that writes innerHTML (stale run detaches fresh panels); nameMap empty at boot is the PRODUCER bug and By Coworker table still shows raw ag- ids."
metadata:
  node_type: memory
  type: project
  originSessionId: 21945e3e-4bd9-4aaf-bbbd-9c31680be940
---

# nanoclaw#1182 — "match unit-cost groups by folder + stop duplicating funnel panels"

PR https://github.com/slang-coworkers/nanoclaw/pull/1182, author **szihs**, base
**`nv-dashboard`**, head **`db3a31e8`**, merge-base `e9521016` (#1181), 2 files
+398/−210 (`dashboard/public/app.js`, `dashboard/server.ts`).
**MERGED `01ed25f2` at 13:50:50Z — 3m22s after opening (13:47:28Z).** All three blob
sets (head / merge commit / current `nv-dashboard` tip) **identical by hash** ⇒ every
finding live. `ci`+`label` green, all 20 CI steps pass. My comment **`5241807730`** via
`gh api repos/.../issues/1182/comments --method POST --input comment.json`.

**Routing: INLINE by Main.** Generic `pr_ready_for_review` *"route to `*-pr-approver`"*
string again; no nanoclaw approver wired. [[project_nanoclaw_pr874_webhook_route_approver]].
Direct sequel to [[project_nanoclaw_1172_panel_tests_unreachable]] (the KB-doctor panel
whose shape unit-cost inherited) and #1181 (`db` lazy-open in the same route).

## ⭐⭐⭐ The diff is prettier + 21 lines — measure before reading 584 changed lines

`app.js` reads 375/−209. Ran `prettier --write` on the **base** `app.js` and diffed
against head: **exactly 21 added lines** (comment block, `funnelRenderSeq`, `myGen`/
`stale`, 7 × `if (stale()) return;`). Base fails `prettier --check`, head passes; neither
file is in the gate (`format:check` is `src/**/*.ts` only). ⇒ **`prettier --write` on the
base is a one-command discriminator between reflow and substance** — cheaper than reading
the diff, and it turned a 584-line review into a 21-line one.

## ⛔⭐⭐⭐ MY OWN HARNESS DEFECT: two `new Function` closures = two module scopes

First TWO harnesses extracted `loadFunnel` into a **separate** `new Function` per run, so
each got its own `funnelRenderSeq` and the guard read as a **total no-op** (base and head
both `UNITCOST=2`). That is a *false 🔴 against a working fix* — the most expensive kind.
Fix: declare `let funnelRenderSeq = 0;` in the OUTER scope and `loadFunnel` inside a
per-run factory (`function makeRun(fetch) { <body>; return loadFunnel; }`), so one counter
is shared while each run keeps an identifiable `fetch`. ⭐⭐**When probing a module-level
guard, the harness must reproduce the SHARING, not just the code** — "I extracted the
shipped function" is not enough when the state lives outside it. The tell I missed:
identical output for base and head is more likely an instrument that cannot see the
difference than a fix that does nothing.

## ✅ Duplication reproduces and IS fixed (after the harness fix)

Stub DOM whose `innerHTML=` setter drops children (as the real one does), shipped
`loadFunnel` extracted by the same brace-walk `unit-cost-panel.test.ts` uses:

```
interleave A's kb/uc after B cleared the pane
BASE: 4 containers ["RQ","UNITCOST","KB","UNITCOST"]  UNITCOST=2
HEAD: 3 containers ["RQ","KB","UNITCOST"]             UNITCOST=1
harsher (stale botc mid-B) BASE: KB=2 UNITCOST=2      ← the prod 2×/3× shape
```

## 🔴 The guard covers the three `appendChild` panels and skips the one `innerHTML` block

All awaits in rq/kb/uc are guarded. The **bot-contributions** block (`app.js:445-456`) has
**none** — and it is the earliest await after `#funnel-detail` is claimed, and it writes
`detail.innerHTML` (which **discards children**). Constructed on head:

```
HEAD  B mid-flight : boxes ["<rqBox empty>"]
HEAD  after A stale: boxes []                  ← rqBox DETACHED
HEAD  B finished   : boxes ["KB","UNITCOST"]   ← RQ panel silently gone
```

Same via the `catch` (`detail.innerHTML = ''`) when A's botc **rejects** ⇒ empty pane after
a successful fresh load. **Control**: adding the 2 missing checks to that block returns
`["RQ","KB","UNITCOST"]` ⇒ the finding is the omission, not the ticket design.
⭐⭐⭐**A generation guard is only as complete as its WEAKEST DOM write, and the dangerous
write is the one that CLEARS (`innerHTML=`), not the one that appends** — the author
guarded the three blocks they were thinking about and missed the one above them.

## 🔴 Producer-side: `nameMap` is EMPTY at boot — verified BY EXECUTION

`refreshCcusageCacheInner` (`server.ts:2600`) wraps the whole name lookup in `if (db)` and
`:2717` falls back to `nameMap.get(agDir) || agDir`. Instrumented the producer, booted the
real server via `startServer()` against a seeded temp DB:

```
[PROBE] db=NULL nameMap=0 -> groupName = ag-1780667166439-vmjrwe
[PROBE] db=NULL nameMap=0 -> groupName = ag-1780667166439-vmjrwe
--- forceOpenDbForTests() (as any /api/state request does) ---
[PROBE] db=OPEN nameMap=2 -> groupName = slang-fixer
```

The boot warm-up (`:12016`) runs before anything lazily opens `db` (`:4041`/`:4119`/`:7749`)
⇒ **the first cache is id-keyed for every entry** = szihs's `ag-1776713211742-1w6l4e`
observation, and it **self-heals** on a later refresh ⇒ reads as intermittent.
`/api/unit-cost` is now immune (resolves ids itself) but `/api/costs` → `byCoworker` →
**By Coworker** table (`app.js:9739`, `cw.groupName`) still renders raw `ag-…` on a freshly
booted dashboard. **Same root cause, one route fixed, the other not.** Producer fix is the
same one-liner #1181 applied: `if (!db) db = openDb();` before the `nameMap` build.

## ✍️ The PR's decoy argument is NOT what prod shows — and the real argument is stronger

Body claims name-matching *"would have re-admitted precisely the groups the six-group list
exists to exclude"*. Measured against live prod (20 groups): **folder-match → the six;
resolved-name-match → the six; decoys admitted by name → NONE.** `Slang Fixer` /
`Slang-Reviewer` differ by name too. ⇒ the stated justification is false.

The correct argument is **structural**: `folder` is `UNIQUE` in the schema, `name` is not —
prod carries **two rows named `Slang Maintainer`** (`slang-maintainer`, `slang_maintainer`).
A group renamed to `slang-fixer` collides with no constraint, and `nameMap` is keyed by id
so **both** survive into `byGroup` ⇒ spend double-counted. Folder cannot do that.
⭐⭐**A right change with a wrong reason: keep the change, replace the reason** — and the
uniqueness constraint was discoverable in one `ncl groups list --json` + `Counter`.

## 🟠 "24 tests still pass" is a no-regression statement, not coverage

24/24 at head **and the identical 24 at base**. Full `dashboard/`: 168 passed / 2 failed at
head, **byte-identical 168/2 at base** (`server.test.ts` v1-import, pre-existing) — the
baseline control. `grep funnelRenderSeq dashboard/*.test.ts` → **0**; `grep unit-cost
server.test.ts` → **0** ⇒ deleting the guard, or reverting the folder map, leaves the suite
green. Also: `isUnitCostGroup`'s contract silently changed name→folder, its decoy test
still asserts against *names*, and its doc comment (`unit-cost.ts:29` *"by name"*) is stale.

## Method notes

`git worktree add -d <sha>` for both head and base (detached; the #1169 branch-name
worktree moved a ref). `node_modules` symlinked from `nanoclaw-kb`. `ccusage` is NOT
resolvable in this checkout ⇒ `ccusageUnavailable()` is non-null here, which is why the
producer probe had to instrument `refreshCcusageCacheInner` directly rather than read a
populated cache. `server.ts` restored from `/tmp/server.ts.orig` and `git status` verified
clean after the probe.

**RESUME** = szihs replies to `5241807730` ⇒ both 🔴 are small (2 lines / 1 line) and both
are LIVE on `nv-dashboard`; offer the extract-`loadFunnel` test (~40 lines, fails at base,
passes at head, fails again with the guard removed).

See also [[project_nanoclaw_1160_empty_state_torn_publish]],
[[feedback_a_control_validates_the_instrument_never_the_target]],
[[feedback_control_the_instrument_not_the_reasoning]],
[[feedback_a_guard_can_be_inert_and_read_as_passing]].
