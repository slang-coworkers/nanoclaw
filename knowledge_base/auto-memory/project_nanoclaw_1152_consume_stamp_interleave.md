---
name: project_nanoclaw_1152_consume_stamp_interleave
description: "slang-coworkers/nanoclaw#1152 — the FIX for my own #1109 Finding 1 (consume/stamp retirement race). Reviewed INLINE at 7d648d2c8, comment 5231572738. 3 findings, all EXECUTED: agent-writable journal discharges a FOREIGN grant's obligation; release_orphaned renders as 'no enforcement releases'; one release → two rows. CI red = #1150's ccusage lockfile, NOT the PR."
metadata:
  node_type: memory
  type: project
  originSessionId: gh-issue-slang-coworkers/nanoclaw-1152
---

**slang-coworkers/nanoclaw#1152** — `critique-gate: close the consume/stamp interleaving that
manufactured a bogus escalation`, author **szihs** (human), base `nv-main`, branch
`fix/nv-main/critique-consume-stamp-atomicity`. 9 files, +1111/−82. Reviewed 2026-08-09 at head
**`7d648d2c8`**, comment `5231572738`.

**ROUTING: handled INLINE by Main — ~29th instance.** Webhook carried the generic post-#874
"route to *-pr-approver" task string; standing rule overrides (nanoclaw platform-infra fork, no
nanoclaw approver wired). See [[project_nanoclaw_pr874_webhook_route_approver]].

**Direct follow-up to MY OWN [[project_nanoclaw_1109_escalation_retire_race]] Finding 1.** The fix
is correct: `retirementDecision` replaces the boolean `isEscalationSpent`, `release_recorded_at`
makes consumption≠completion, and the hold is bounded (`RELEASE_STAMP_TIMEOUT_SECS` 900s) so it
does not trade the race for the wedge #1109 removed.

## ⭐⭐⭐ TWO `synchronize` PUSHES MID-REVIEW — both benign, established BY HASH not by reading
Head moved `cfa6b3bec` → `6ab623c8b` → `7d648d2c8` while I reviewed. Compared all 9 files per push:
rebase + 5 mock-grant `release_recorded_at: null` additions only; **4 sources + migration 936
IDENTICAL by blob hash across all three heads** ⇒ nothing I'd read went stale. The per-file hash
loop is the cheap discriminator; re-reading the diff would have cost 3× and proved less.

## ✅ Author's env claims — ALL held on my mount, incl. one I expected to fail
17 host tests RED pre-fix (exactly 5+7+5 per-file, revert 4 sources + move migration aside, keep
tests) · 115/115 at head · container 127/127 head, 1 RED with only `poll-loop.ts` reverted · the
"honest exception" genuinely passes pre-fix · full suite 24 failing FILES at head == **24 at base,
identical set** ⇒ no regressions · `typecheck-gate` fails on my edge **but identically at base**
(branch-installed channels absent from a bare checkout) ⇒ my instrument, their claim stands.

## ⛔ MY INSTRUMENT DEFECT — nearly charged 3 failures to the PR
First container run: 3 fails in the critique-gate block. Cause was **`CRITIQUE_GATE_ACTIVE=0`
leaking from MY OWN container's env into `bun test`**; `env -u CRITIQUE_GATE_ACTIVE` → 127/0 at
**both** base and head. ⭐⭐⭐**A test that reads env is a test whose result is a property of the
shell you ran it in — run the base control BEFORE attributing any failure.** Also worth flagging:
the author's characterisation ("missing agent-runner node_modules") does not match this mechanism;
I said so rather than letting the number agree by coincidence.

## 🔴 F1: the release journal is agent-writable and discharges FOREIGN obligations
`ingestReleaseJournal` (`index.ts:460`,`:478`) reads `entry.grant_id` and calls
`markBypassGrantReleaseRecorded` with **no session-ownership check**. Journal path =
`dirname(escPath)` = `/workspace/.claude/`, and `sessDir` is bind-mounted **rw**
(`container-runner.ts:837`). EXECUTED: one forged line in an attacker session set the victim
grant's `release_recorded_at`, and the row imported `requested_at: 1000` from the foreign grant
⇒ the fabricated attribution the PR kills reappears by another route. Self-directed case needs no
foreign id: `applyBypassApproval` writes `grant_id` into BOTH agent-readable files (`:720`,`:747`).
⇒ **The PR's sentence "not reachable from any container" is over-stated: the COLUMN is host-owned
but the WRITE is triggered by container-supplied data.** Fix: `grant.session_id === session.id`.

## 🔴 F2: `release_orphaned` renders as "no enforcement releases"
PR claims it "shows up on the dashboard's escalation panel without further work." EXECUTED by
brace-extracting `renderEscalationStrip` from `nv-dashboard`'s `app.js` and feeding it the API
shape: orphans-only → **"no enforcement releases"**. `server.ts:11609` computes `released` from an
**allowlist** (`approved`|`failed_open`). ⭐⭐**A new event kind is not additive into an allowlist —
the panel positively ASSERTS THE OPPOSITE of the integrity event.** Compounding: `summarizeEscalations`
(`src/db/critique-escalations.ts:141`) has **0 callers on nv-main** (git grep: definition only) —
real consumer is nv-dashboard's own inline SQL ⇒ same producer/consumer branch split as #1117.

## 🟡 F3 / F4
F3: agent chooses `event_id`, gate chooses its own ⇒ keys differ ⇒ **ONE release → TWO `failed_open`
rows** (executed), inflating the exact dashboard headline. Key on the grant instead.
F4a: `${RANDOM:-0}` is bash-only — under `sh` two ids in one second are IDENTICAL (measured) and the
dedupe index would silently collapse them. F4b: journal re-ingested in FULL every sweep (600 lines →
500 calls, 1000 cumulative by sweep 2); `slice(-500)` is a **window not a prune**, so the 100 oldest
are **never recorded at all** ⇒ the over-bound `error` means "releases dropped unread", not just "loop".

## ✅ CI red is NOT theirs
`ERR_PNPM_OUTDATED_LOCKFILE — ccusage@20.0.19`. Branch doesn't touch `package.json`; **#1150 landed
ccusage on nv-main after they branched**. Reproduced ci.yml's composed-state merge locally
(BASE=nv-main ⇒ `OWNED_SRC=HEAD`): **merge-base fails identically (positive control)**, rebase →
`lock_ccusage=21`, clears. Rebasing is the whole fix.

## Resume
Verdict: **NOT a blocker on the enforcement contract** (nothing opens the gate that was shut).
F1 is a one-line fix worth having before merge. Merge is szihs's. RESUME = szihs replies.
**F2's allowlist gap is LIVE on `nv-dashboard`** and also swallows `state_divergence` from #933.
