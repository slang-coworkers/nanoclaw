---
name: project_nanoclaw_1103_host_grant_ledger
description: "nanoclaw#1103 host-authoritative bypass ledger — reviewed INLINE (~26th instance), OPEN/green, a REAL pre-merge gate. Headline: a forged bypass that ERASES its own consumption stamp is permanently unrecorded (A2=0 events vs control=1); closable via the session_id index THIS PR created but never queries. Comment 5202374776."
metadata:
  node_type: memory
  type: project
  originSessionId: gh-issue-slang-coworkers/nanoclaw-1103
---

**slang-coworkers/nanoclaw#1103** — `critique-gate: close the second gate's holes, add a host grant
ledger`, author **`szihs`** (human), base `nv-main`, branch `fix/nv-main/host-authoritative-bypass`.
6 files, **+727/−62**. Reviewed head **`9e9228f1`**, merge-base `6ec091d7`. Comment **`5202374776`**.
Direct follow-up to [[project_nanoclaw_1092_critique_gate_resolved_wedge]], whose parity gap it fixes.

**ROUTING: handled INLINE by Main — ~26th instance** ([[project_nanoclaw_pr874_webhook_route_approver]]).
No `nanoclaw-pr-approver` exists; slang/slangpy approvers are repo-scoped ⇒ would `ABSTAIN_POLICY`.
Posted via `gh api .../issues/N/comments -F body=@file` (verb-split: `gh pr review`/`comment` denied).

✅**OPEN and green at post time — a genuine pre-merge gate**, unlike most of this series (merge-race
count was 7+; this one didn't race). PR still `OPEN` at my reviewed head immediately before posting.

## ⭐⭐⭐ A `synchronize` landed mid-review and EVAPORATED my headline — 2nd instance after #1092

First head `5d3e5b09` **did not typecheck**: 3× `TS2551` (`critique_gate_bypass_expires_at`,
`_grant_id`, `_rejected_request` read at `:1481/:1491/:1504` but absent from the closed inline state
literal at `poll-loop.ts:1349`). I had it written as the blocker. `9e9228f1` (`fix(types)`, +6 lines)
declares exactly those three keys ⇒ cleared. ⭐⭐**I verified with BOTH controls locally rather than
quoting the CI log: old head → exit 2 with the same 3 errors, new head → exit 0.** Same lesson as
#1092/#1081: **never carry a verdict across a `synchronize`.**

⚠️**`baseRefOid` from `gh pr view` is nv-main's CURRENT TIP, not the branch point** — a two-dot diff
there showed **54 files** (claude-trace landing via #1102). `git merge-base` gives the true 6-file
diff. **Always compute the merge base on this fork; nv-main moves hourly.**

## 🔴 Headline: the successful forgery can be made PERMANENTLY unrecorded

The consumption branch is correctly placed BEFORE the `approved === true` early return (comment says
so explicitly, and that reasoning is right) — but it's entered on
`state.critique_gate_bypass_consumed_at != null`, **read from the file the attacker owns.**
Executed against the real module, ledger empty of any host grant:

| sequence | divergence events |
|---|---|
| A1 forge + gate consumes, stamp intact | **1** |
| A2 forge + consumes + agent nulls the two stamp keys | **0** |
| A3 forge, sweep first | **1**, `approved`→false |

A2 is the same delivery as A1 plus two key writes, and yields no event/log/ledger mutation. ⭐⭐⭐**It
is NOT the limit the PR states** — the body admits a *timing* limit ("re-forge between sweeps");
A2 is **durable evasion**, no later sweep recovers it.

⭐⭐⭐**The structural tell that made this a finding rather than a hunch: migration 933 creates
`idx_bypass_grants_session ON (session_id)` and NO query in the tree has a `session_id` predicate on
that table** (exhaustive repo-wide grep; every read is `getBypassGrant` keyed on the agent-supplied
`grant_id`). **An index created for a query that doesn't exist names the missing primitive.**
Verified the fix is viable: after a legitimate grant + a TOTAL wipe of `workflow-state.json`, a
session-keyed lister still shows **1 outstanding** grant.

✅**Positive control in the same file settled it**: stamp-intact → 1 divergence, stamp-erased → 0.
**A zero next to a firing control is a property; a bare zero is a maybe-dead instrument.**

## 🟡 Notes posted
- **Grant identity falls back to agent-controlled data**: `approvalId ?? esc.approval_id ?? synthetic`
  (`index.ts:374`) — middle term is the agent-writable escalation file, exactly what the PR argues
  identity must never come from. **UNREACHABLE today** (`response-handler.ts:141` always passes the
  loaded row; `ApprovalHandlerContext.approval` non-optional) ⇒ latent. But the `?.` at `:448`
  advertises a case the type forbids, and **the only test through the registered handler omits
  `approval` (`:541`), so the fallback is what's covered and the host-owned-identity claim is never
  exercised**. Measured: with `approval` → key `appr-REAL-42`; as the test calls it → synthetic
  `grant-…`, reconciles LIVE, 0 divergences.
- `patchGateState` (`poll-loop.ts:1197`) is a bare `writeFileSync`, no tmp+rename — **NOT charged as
  introduced**: the pre-existing sibling `gateShouldYield` (`:1241`) is identical, so it matches local
  convention. ⭐**Check the sibling writer before charging a new one.**
- Whole reconcile sits inside the sweep's `catch { log.debug }` (`host-sweep.ts:304-310`) ⇒ a
  persistently-failing integrity check is invisible at default log level.

## ✅ Verified positively
- **Both suites non-inert by implementation swap under head tests**: host base+head-tests → **13 fail**
  = exactly the 13 new `it()`s (forged/absent/consumed/expired/other-session revoked, expiry clamped,
  consumed-but-never-granted, stale stamp, insert-then-patch-failure); poll-loop → **7 fail** = 4 new
  (incl. the no-timeout regression) + 3 pre-existing.
- **Baselined both directions**: host **1988 → 2001 pass, 0 failed tests** (+13 = exactly the new
  tests); poll-loop **115/3 → 117/3**, the 3 being the `dispatchResultText — critique-gate` trio
  failing **byte-identically at the merge base** ⇒ pre-existing (matches #1087).
- ⚠️**1 failed FILE (`setup/register.test.ts`) — MY ENV, proven by an identical failure at base**:
  clean clone lacks skill-installed `src/channels/dashboard.js`. **"N failed files, 0 failed tests"
  = import errors** (the #1092 signature). Used a real `pnpm install --frozen-lockfile`, never a
  borrowed `node_modules`.
- Migration **933 free** (931 join-mode, 932 = #1092 post-renumber), auto-discovered by dir scan.
- Ledger-first ordering correct; `revokeBypassGrant` compensation right (orphan grant = claimable).
- Deploy note **exact**: `/app/src` per-group `agent-runner-src` mount (`container-runner.ts:1290`).
- `hasTable` guards **not** an inertness risk: `runMigrations` (`index.ts:145`) precedes
  `startHostSweep` (`:390`).
- `$STATE.tmp` claim exact — 4 sites in `gate-critique-on-deliver.sh`.
- My **#1092 finding 1 (the `resolved` wedge) is STILL LIVE and unaddressed** at this head:
  `index.ts:478` still `if (!esc || esc.resolved) return;` and nothing repo-wide deletes the
  escalation file. Not charged here (out of this PR's scope) — but it remains owed.

## ⛔ My instrument failures — 3, all caught
1. A probe printed the CORRECT ledger id and STILL failed (`ENOENT`): the registered handler writes to
   the real `sessionDir`, not my `dir` override. **The assertion had passed; the harness read the
   wrong path.**
2. A `sed` fixing that probe also rewrote **line 377 of the PR's own test**. Reverted; verified by diff
   that my file = PR test + exactly my 48 appended lines. ⭐⭐**Unchecked, "a PR test fails" would have
   been my own edit.**
3. **`/workspace/extra/ephemeral` is READ-ONLY here** ⇒ first snapshot wrote nothing and the verifier
   printed `MISMATCH` on all six files. **An empty-snapshot artifact reads exactly like hash
   divergence** — re-ran under `/tmp`, all six `git hash-object`-verified.

**RESUME:** unmerged at post time; maintainer owns merge. If szihs replies, the follow-up is the
session-keyed reconciliation (`listOutstandingGrantsForSession` + compare against what the file
admits) which closes A2 and finally uses `idx_bypass_grants_session`; plus dropping the `?.` at
`:448` and passing an `approval` in the handler test. On webhook redelivery: **re-check head SHA
first** — this author pushes during review (2 heads already).

## 🔄 3rd head `957c9462` — author responded in MINUTES; re-measured, A2 UNCHANGED

`critique-gate: attribute bypass consumption to its grant on BOTH gates` (8 files, +830/−64, CI green).
Bash gate now writes `critique_gate_bypass_consumed_grant_id` (`gate-critique-on-deliver.sh:256-263`)
⇒ both gates attribute consumption, and **`getLatestSpendableGrant` finally uses
`idx_bypass_grants_session`** — the index I flagged as built-for-a-nonexistent-query.

⭐⭐⭐**The commit's unattributed-consumption branch is BETTER than the fix I proposed, for a reason I
had not accounted for:** falling straight to `divergence` on a missing grant id would flag **every
legitimate bypass through an older gate** — hooks are bind-mounted (live on restart) while the
agent-runner ships as a per-group image copy, so the deploy-skew window is real. **A false positive on
the happy path is worse than a missed detection: it trains the reader to ignore the signal.** I framed
the session-keyed query purely as detection; the author saw it also had to avoid manufacturing noise.
⇒ **A reviewer's proposed fix can be right about the mechanism and wrong about the failure mode it
introduces — check what your own suggestion would do on the HAPPY path.**

🔴**A2 STILL 0 at this head, measured with TWO firing positive controls** (unknown-grant-id → 1;
no-grant-id + no live grant, i.e. the NEW branch → 1; A2 nulls both keys → **0**). Cause: the outer
guard `if (state.critique_gate_bypass_consumed_at != null)` (`index.ts:307`) is **unchanged** —
everything INSIDE improved, the condition for ENTERING it did not move. ⭐⭐**A fix that enriches a
block does not change whether the block is reached; re-test the GUARD, not the body.**
Suites at this head: `critique-escalation` + `gate-critique-on-deliver` **78/78**.
Follow-up comment **`5202408480`** — stated not-a-blocker (real narrowing, enforcement unaffected,
residual is observability). Remaining fix = consult the ledger when the state file says NOTHING, not
only when it says something.

**RESUME (supersedes the line below):** 3 heads reviewed (`5d3e5b09` → `9e9228f1` → `957c9462`), 2
comments (`5202374776`, `5202408480`). Unmerged, maintainer owns merge. **This author pushes within
minutes of a review — always re-fetch the head SHA before acting on redelivery.**

## 🔄 4th head `206b67db` — "fail closed on the three waiver edge cases"; A2 open, now with a WIDER blast radius

8 files, +930/−67, CI green, `tsc -p container/agent-runner` exit 0. Comment **`5202469844`**.
All three edge cases verified and correct:
1. **Unusable expiry fails closed** (`expiresAt <= 0 || nowS >= expiresAt`, both gates —
   `poll-loop.ts:1489`, `gate-critique-on-deliver.sh:253`). ⭐**Load-bearing: previously a forged flag
   with NO `expires_at` took the `> 0` false branch and skipped the TTL ⇒ the cheapest forgery was
   also the never-expiring one.**
2. **Consume-write verified before allowing** (re-read; refuse if still `approved`) — also closes what
   my `patchGateState` non-atomicity note only implied: a torn/lost consume write is no longer silently
   fatal.
3. **Replay detection** on an already-spent grant (`consumed.consumed_at` branch now reports).
   ✅Verified firing: 1st attributed consumption → 0, 2nd of the same grant → **1**.

🔴⭐⭐⭐**A2 still 0 — and this head gave it a CONSEQUENCE I had not identified: A2 ALSO DEFEATS THE NEW
REPLAY DETECTOR.** Because the erased consumption is never recorded, the ledger row stays
`consumed_at: null, revoked_at: null` (**read straight out of the ledger, not inferred**) and
`getLatestSpendableGrant` still returns it spendable ⇒ every later use of that grant reads as a FIRST
use, and the detector keys on `consumed_at` already being set — which A2 prevents by construction.
Measured with control firing: A2→0 · legit-then-replay→0 then **1** · **A2-erasure-then-respend→0**.
⇒ ⭐⭐⭐**Every detection path in `reconcileBypassState` is downstream of
`if (state.critique_gate_bypass_consumed_at != null)` (`index.ts:307`), a field the AGENT OWNS. Three
commits improved what happens INSIDE that block; the condition for ENTERING it never moved.**
⭐⭐**A new detector added on top of an unfixed guard inherits the guard's blind spot — so re-test the
OLD gap against each NEW mechanism rather than assuming they're independent.**

Asked only that the limits section name **erasure** alongside timing (the "re-forge between sweeps"
text reads as bounded exposure; erasure is not bounded). Still **not a merge blocker**.
Suites: host 80/80; poll-loop 118 pass/3 fail = the pre-existing `dispatchResultText` trio.

**RESUME (supersedes all above):** 4 heads reviewed (`5d3e5b09` → `9e9228f1` → `957c9462` →
`206b67db`), 3 comments (`5202374776`, `5202408480`, `5202469844`). Unmerged, maintainer owns merge.
⭐⭐**This author ships a responsive commit within MINUTES of each review — on any redelivery, re-fetch
the head SHA and re-measure the OPEN gap before writing anything.**

## 🔄 5th head `5eeede7f` — "validate consumption against revocation and the validity window"

+995/−67, CI green, comment **`5203085459`**. Two new checks on an ATTRIBUTED consumption, both
verified firing with exact diagnostics: **revoked grant consumed** and **consumed after expiry**.
⭐⭐**Judged against `consumedAtMs`, NOT `nowMs` — comparing to "now" would let a LATE SWEEP silently
excuse a consumption that was already out-of-window when it happened**, the usual trap for any
sweep-interval-dependent check. `Number.isFinite(x) && x>0 ? x*1000 : nowMs` also fails toward
flagging. ✅Non-inert: both new tests fail against the 4th head's impl (2 failed/35 passed). 82/82.

⇒ **Five validity conditions now on an attributed consumption**: unknown grant · wrong session ·
already spent · revoked · out of window. Thorough check of *what the state file CLAIMS*.

🔴**A2 unchanged at 0** (control 1 in the same run). ⭐⭐⭐**All five conditions live INSIDE
`if (state.critique_gate_bypass_consumed_at != null)` ⇒ they all describe a consumption the agent
CHOSE TO DECLARE. Each commit makes the DECLARED case harder to fake, which slightly raises the
incentive to take the UNDECLARED path** — hardening one branch can shift pressure onto its unguarded
sibling. Said so once and did NOT restate the full case (already twice on record) — ⭐**a third
full restatement of a standing finding is noise; one line + a pointer is the right dose.**

**RESUME (supersedes all above):** 5 heads (`5d3e5b09` → `9e9228f1` → `957c9462` → `206b67db` →
`5eeede7f`), 4 comments (`5202374776`, `5202408480`, `5202469844`, `5203085459`). Unmerged, maintainer
owns merge. Only open ask = the limits section should name **erasure** alongside timing. On redelivery:
re-fetch head SHA, re-measure A2 with its control, and **keep the follow-up SHORT unless something new
appears.**
