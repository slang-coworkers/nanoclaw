---
name: project_nanoclaw_1181_lazy_db_unit_cost
description: "nanoclaw#1181 (szihs, nv-dashboard, OPEN) adds `if (!db) db = openDb()` to /api/unit-cost. Reviewed INLINE, comment 5241261600, non-blocking. Root cause traced: broadcastState() early-returns with 0 clients so the 5s timer never opens db — first BROWSER attach does. /api/overview + /api/tasks share the defect and ship fabricated zeros. search/code returns 0 for EVERY query on this repo — it is a FORK and GitHub does not index forks; my first attribution to the size-ceiling defect was wrong."
metadata:
  node_type: memory
  type: project
  originSessionId: 5a258a28-529a-4d47-b0bb-55447582c602
---

# nanoclaw#1181 — "dashboard: open the DB lazily in /api/unit-cost"

PR https://github.com/slang-coworkers/nanoclaw/pull/1181, author **szihs**, base **`nv-dashboard`**,
head **`143549f1fbc4c94ee6d9b8b58a5d88d62be2fc44`**, **1 file +5/−0** (`dashboard/server.ts:7745-7749`).
Both checks green (`ci` 3m7s, `label` 3s) — only 2 workflows fire on this branch (`CI` on
`pull_request`, `Label PR` on `pull_request_target`). 0 reviews / 0 comments at my post.
Follow-up to **#1180** (`costpanel`, MERGED `ffa3fa94` 13:29, 5 files +741/−10) — 1181 opened ~10 min later.
My comment **`5241261600`** via `gh api -X POST .../issues/N/comments` (REST path; `gh pr comment`
403s — [[project_nanoclaw_1169_fixture_not_verbatim]]).

**Routing: INLINE by Main**, standing rule [[project_nanoclaw_pr874_webhook_route_approver]] — the
`pr_ready_for_review` webhook carried the generic *"route to the project's `*-pr-approver`"* string;
no nanoclaw approver is wired (destinations list confirms only `slang-pr-approver` /
`slangpy-pr-approver`, both COMPILER-product approvers).

## The claim HOLDS — and the mechanism is more specific than the PR body says

`db` declared `:587`, assigned in exactly **3** places on this head (`grep` for assignment, not
mention): `getStateCache()` `:4041`, `forceOpenDbForTests()` `:4119`, and the new `:7749`.
⭐**Why it stays null on a fresh boot:** the only production opener is behind
`broadcastState()` `:4123`, which **early-returns when `wsClients.size === 0 && sseClients.size === 0`**.
So the 5s `broadcastTimer` `:12004` does NOT open the handle — the first **browser** attach does
(`/api/state` `:5332`, SSE `:5598`, or WS `:11938`, all of which call `getStateCache()`).
⇒ curl before any browser attaches → `central DB unavailable` on a healthy box; attach once and it
never reproduces. Predicts "the first time it was hit" exactly. **The PR body says "opened lazily";
the load-bearing detail is the CLIENT-COUNT gate, which is what makes the window survive boot.**

## 🟠 The real finding: two sibling routes have the same defect and FABRICATE numbers

`/api/overview` `:7624` and `/api/tasks` `:7831` sit in the same null-`db` window but answer **200
with zeros / `[]`** instead of an unavailable marker — inverting the exact property #1180 was built
around (`Unavailable` not `$0`). ⭐**`/api/health` `:5340` is immune because it routes through
`getWriteDb()` ⇒ during the window health says `ok: true` while `/api/overview` reports zero agent
groups.** Only the 2 a2a routes (`:7386`, `:7537`) do it right: honest `503 database unavailable`.

⭐⭐**Right fix is an accessor, not a 3rd inline open.** Both siblings already hide this:
`writeDb`→`getWriteDb()` `:592`, `hookEventsDb`→`getHookEventsDb()` `:1373`. `db` alone is a bare
variable with **37 `db.prepare` call sites** and 38 truthiness guards. A `getReadDb()` closes the
class. Flagged as follow-up, not blocking a 1-line fix.

## 🟡 Comment direction inverted; 🟡 structurally unpinnable

- New comment says *"see the `if (!db) db = openDb()` **further down**"* — both existing sites are
  **above** `:7749`; **none below**. Wording bug in the artifact that explains the fix.
- **No test touches `/api/unit-cost`.** The trap: every db test in `server.test.ts` opens with
  `forceOpenDbForTests()`, so a house-style route test **passes identically with and without the
  fix**. A pinning test must deliberately OMIT it. ⭐`forceOpenDbForTests()` existing at all means
  null-before-open was already known observable — this is its second surfacing.

## ⛔⭐⭐⭐ `search/code` returns 0 for EVERY query on this repo — and my first diagnosis was WRONG

`search/code?q=repo:slang-coworkers/nanoclaw+"api/unit-cost"` → `total_count: 0`, which would have
let me publish the "no test" claim on a broken instrument. Replaced with **tree enumeration**
(`git/trees/<sha>?recursive=1` → 146 `*.test.ts`, grep each): same verdict, now measured.

⚠️**I first filed this as "the known search/code under-reporting" (the size-ceiling mechanism from
[[feedback_search_code_total_count_is_not_a_file_count]], and finding 2 of
[[project_nanoclaw_1179_action_sha_pins]]). That attribution is FALSE.** Measured:

| query | total_count |
|---|---|
| `repo:slang-coworkers/nanoclaw+nanoclaw` (in `package.json` on the default branch) | **0** |
| `repo:slang-coworkers/nanoclaw+handleRequest` | **0** |
| `repo:slang-coworkers/nanoclaw+unitCostByWeek` | **0** |
| `repo:nanocoai/nanoclaw+nanoclaw` (positive control, fork SOURCE) | 293 |
| `repo:shader-slang/slang+kIROp_DebugScope` (positive control, non-fork) | 10 |

⇒ **NOT a partial under-report — the repo is entirely absent from the code index.**
`slang-coworkers/nanoclaw` has **`fork: true`** (parent `nanocoai/nanoclaw`); both positive controls
are non-forks and both return real counts. GitHub does not index forks for code search.
⚠️**Honest scope: I established the EFFECT decisively (3 queries incl. a guaranteed-present term, all
0, against 2 working positive controls) but the CAUSE from a sample of ONE fork — fork-status is the
best explanation, not a discriminated one.** Don't restate it as proven for other forks without a
second instance.

⭐⭐⭐**Consequence for every nanoclaw review — mine and any peer's: `search/code` on
`slang-coworkers/*` forks is not a weak instrument, it is a DEAD one that reports `0` with exit 0 and
no flag.** A "no test exists" / "nothing references X" claim sourced from it is unfalsifiable noise.
Use `git/trees/<sha>?recursive=1` + per-file `contents?ref=`, or a local clone. Note the default
branch is **`nv-coworkers`**, which does not even contain `dashboard/` — so a `contents` 404 there is
also not evidence of absence.

⚠️Side observation, unresolved: `gh api repos/nanocoai/nanoclaw` → **401 Bad credentials** (token is
scoped to `slang-coworkers`) while `search/code` against that same cross-org repo returned 293.
**Auth is per-path** — consistent with the `rate_limit`-401-while-others-200 case already filed.

⚠️Also corrected a **fabricated figure in my own draft**: I wrote *"~30 read sites"* from eyeballing,
then measured 37 `db.prepare` sites before posting. A `~` does not make an unmeasured number honest.
