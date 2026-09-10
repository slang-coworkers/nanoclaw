---
name: project_nanoclaw_1109_escalation_retire_race
description: "slang-coworkers/nanoclaw#1109 (#1092 F02 follow-up) — retirement re-opens the consume-vs-stamp race → permanent uncleared card; forged `resolved` launders a rejection; reviewed inline, comment 5205441138"
metadata:
  node_type: memory
  type: project
  originSessionId: gh-issue-slang-coworkers/nanoclaw-1109
---

**slang-coworkers/nanoclaw#1109** — `fix(critique-escalation): record the fail-open, and retire spent
escalations (F02, #1092 follow-up)`, author **`szihs`** (human), base `nv-main`, branch
`fix/nv-main/critique-escalation-lifecycle`, head `16b6ee51`. 2 files, +233/−12
(`src/modules/critique-escalation/index.ts` +104/−12, `src/critique-escalation.test.ts` +129).
CI all green (`check`/`ci`/`label`), `mergeStateStatus: CLEAN`. Reviewed 08-06, comment `5205441138`.

**ROUTING: handled INLINE by Main — ~23rd instance** (NanoClaw platform-infra fork, never to a
`*-pr-approver`; see [[project_nanoclaw_pr874_webhook_route_approver]]). This one is the direct
follow-up to **my own** [[project_nanoclaw_1092_critique_gate_resolved_wedge]] findings — it fixes
F02 (= my Finding 2, the unrecorded admin-approved fail-open) and F01-by-side-effect (the wedge).

## ⭐⭐⭐ THE AUTHOR SAID "vitest CANNOT RUN ON THIS MACHINE" — IT RUNS ON MINE

PR body verbatim: *"`vitest` will not start here: `@rolldown/binding-darwin-arm64` is missing … I am
not claiming the suite passed — **CI runs it**"*, and he substituted a hand-rolled `bun` harness
(10/10 head, 6/10 base). ✅**I ran the real A/B he could not**, via two worktrees off the kb clone
with `node_modules` symlinked from `/workspace/agent/nanoclaw-kb`:

| run | result |
|---|---|
| new suite @ `16b6ee51` | **42/42 pass** |
| base `e81a0cc76` suite unmodified (**positive control**) | 37/37 pass |
| new tests + `index.ts` reverted to base | **5 failed / 37 passed** |

The 5 failures are exactly his new cases; the 37 pre-existing pass unchanged ⇒ no regressions AND
the tests aren't vacuous. ⇒ ⭐⭐**When an author states an environmental blocker, CHECK IT ON YOUR
OWN MOUNT before accepting the substitute — "cannot run here" is a claim about THEIR container, and
`/workspace/**` is per-container** ([[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]] 3rd-instance rule).
Reverting only `index.ts` while keeping the new tests is the A/B that matters; `git checkout
origin/nv-main -- <one file>` + `diff` to confirm the revert landed.

## 🔴 Finding 1: retirement re-opens the race it exists to close, and the recreated file cards forever

`isEscalationSpent` treats `grant.consumed_at !== null` as "nothing more is due to land in this
file." But **consumption and the stamp are two separate writes in the gate**, in this order —
`gate-critique-on-deliver.sh:262-282` (`mv` state → verify `STILL_APPROVED` → `stamp_failed_open`);
`poll-loop.ts:1500-1524` identical. A 60s sweep landing between them sees `consumed_at` set and
`failed_open_at` absent, judges the file spent, and **retires the file the stamp is about to be
written into**.

`stamp_failed_open` then takes its **no-file branch** (`:225-228`) → `{requested_at: 0, …,
failed_open_at}`. The `failed_open` row DOES still get recorded (F02 itself survives) — the damage is
different: the recreated file has no `resolved`, so the sweep walks past §2, and `REASON_FAILED`
isn't self-healable ⇒ §6 **cards a human**. And that card can NEVER be retracted, because
`isRequirementCleared` bails on line 1 for a zero `requested_at` (`if (!requestedAt) return false`).
⇒ the race converts a completed, already-authorised bypass into a **permanent uncleared card** — the
exact queue-residue class #1092 added `isRequirementCleared` to kill.

⭐**Window does NOT exist on base**: there the file is never retired, so `stamp_failed_open` always
finds it and takes the merge branch. **Retirement is what makes the no-file branch reachable on the
ordinary approve→consume path** — a new-behaviour consequence, not a pre-existing bug.

**Measured with a control pair** in his own harness: mid-window sweep → `file exists = false`; stamp
recreates; next sweep → `events = ["failed_open","carded"]`, `requestApproval = 1`; agent then runs
the critique → `isRequirementCleared = false`, card NOT deleted. **Control**: identical file with
`requested_at: 1000` → card retracted ✓.

**Fix I proposed AND verified 3 ways** (thread `stampIngested` in; `dead || (consumed && stamped)`):
with patch **43/43** · patch reverted + race case kept ⇒ **that case fails** (so it tests the patch,
not luck) · **stamp never arrives at all ⇒ held while inside TTL, retired once expired** — bounded,
so it does not trade the old wedge for a new one. ⭐⭐**My FIRST attempt at this fix broke 3 of his
tests** (read `esc.failed_open_recorded` after `patchEscalationFile` had already written it — stale
in-memory object). ⇒ **A proposed fix is a claim; run it against the author's own suite before
publishing it.** Had I shipped v1 I'd have handed him a patch that fails his tests.

## 🟡 Finding 2: forged `resolved` launders a rejection into a fresh card (note, not blocker)

Escalation file is agent-writable. On base a forged `resolved` only wedges the agent itself. With
retirement, `resolved: 'self-healed'` hits the `// the requirement was satisfied to get here` branch
which returns `true` **without checking anything** ⇒ file retired ⇒ gate's rejection scoping
(`CUR_REQ` vs `REJECTED_REQ`, `:294-296`) goes stale on a new `requested_at` ⇒ **the human who said
no is re-carded**. Measured: `requestApproval` calls = 1 after a rejection. No `record()` on that
branch either, so nothing lands in `critique_escalation_events`. Does NOT open the gate. Suggested
close: host already writes `resolved_by: 'host:auto'` at `:656` — gate the branch on that.

**Verdict published: NOT a blocker on the enforcement contract** (nothing opens the gate; invariant
holds). Merge is szihs's. **On redelivery: re-check head SHA first** (author pushes actively); if
still `16b6ee51` the comment stands. Cleaned up both worktrees.
