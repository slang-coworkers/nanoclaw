---
name: project_nanoclaw_1065_reclaim_before_wake
description: "nanoclaw#1065 (szihs, MERGED aef98dd4 08-04) moves bounced-claim reclamation ahead of the wake in sweepSession; no-route (no nanoclaw approver wired, and the repo runs no review bot) + merged mid-verification. All 7 mechanism claims MINE-VERIFIED on baseline source; its added test EXECUTION-CONFIRMED to pass on the pre-fix source (differential run, positive control) ⇒ it does NOT pin the fix. Producer-side gap left open: whole-batch markBounced + extractRouting reading messages[0] is how a NULL-channel task row gets a bounced ack."
metadata:
  node_type: memory
  type: project
  originSessionId: cc711555-126b-4802-b7ca-c0c32aaac73b
---

# nanoclaw#1065 — reclaim bounced claims before the wake

`slang-coworkers/nanoclaw#1065`, author **szihs** (a **human**, not a bot), base `nv-main`,
head `fix/nv-main/reclaim-before-wake` @ `3fdeb8a8a10daec3ccc2b8ce2479aecc063f01cf`,
2 files +68/-5 (`src/host-sweep.ts` +38/-5, `src/host-sweep.test.ts` +30/-0).

**Opened 10:31:27Z → MERGED `aef98dd40b1a51b21cf1d95deb13d727683eb4fc` at 10:44:07Z by szihs
himself (~13 min).** Zero reviews, zero issue comments, zero review comments. CI all-green at head
(`ci` / `check` / `label`). At my first read `ci` was still `in_progress`; it went `success` and the
PR merged while I was verifying — see the timing lesson below.

## Routing disposition — NOT routed to an approver

Same class as #1050 / #1063 / #1064 — see [[project_nanoclaw_pr874_webhook_route_approver]] and
[[project_nanoclaw_kb_sync_pr_autoref_noop]]. The `pr_ready_for_review` webhook carried the generic
post-#874 *"route to the project's `*-pr-approver`"* task string; the **standing rule overrides**:
this is the NanoClaw **platform** repo and **no `*-pr-approver` coworker is wired for it**.

Re-derived rather than inherited (per the #1064 lesson that a standing no-route can be right for a
reason that no longer holds). Both legs checked this tick:
- `ncl groups list` → 20 groups; the only approvers are `slang-pr-approver` (`ag-1783611156430-vvj8oi`)
  and `slangpy-pr-approver` (`ag-1783611156448-d49n0a`). No nanoclaw approver. (grep for
  `nano|approv|kb` over the listing returns exactly those two rows.)
- Both approver SKILL.md frontmatters scope themselves to *"a slang PR"* / *"a slangpy PR"* and to
  harvesting `github-actions[bot]`'s `claude-pr-review.yml` output. `slang-coworkers/nanoclaw` has
  only `ci.yml` + `label-pr.yml` — **there is no review bot on this repo**, so an approver pointed
  here would have no review input to decide from. Corroborated on the previous human code PR:
  #1064 has 0 reviews and 0 comments.

⇒ **Handled inline by Main. No dispatch.** Second consecutive human-authored nanoclaw code PR
(after #1064) hitting this same no-route.

## Mechanism claims — MINE-VERIFIED against baseline source

Verified at baseline `fcb39e4f` (pre-PR `nv-main`) in the local clone
`/workspace/agent/nanoclaw-kb`, reading the *producer and consumer* rather than trusting the PR
body. Every load-bearing claim in the description holds:

| PR claim | Verified |
|---|---|
| a bounced ack hides the row from the container's poll | `container/agent-runner/src/db/messages-in.ts:115` — `pending.filter(m => !ackedIds.has(m.id))`, and `ackedIds` is built from **all** of `processing_ack` with no status filter (`:107-110`) |
| container startup clears only `status='processing'` | `container/agent-runner/src/db/connection.ts:180` — `DELETE FROM processing_ack WHERE status = 'processing'`. A `bounced-*` row survives a restart |
| `syncProcessingAcks` leaves the trigger `pending` | documented at `markBounced`'s doc comment (`messages-in.ts:165-175`): it maps only completed/failed/script-skip:error |
| step 4 was unreachable in both states | baseline `src/host-sweep.ts:320` wakes on `dueCount > 0 && !isContainerRunning`, then **`:328` re-reads `alive`**, and `:343` gates step 4 on `!alive`. So a due hidden message spawns a container at 320 and closes the 343 gate itself. Container-up case is skipped by the same gate |
| `countDueMessages` does not join `processing_ack` | `src/db/session-db.ts:136-147` — `messages_in` only; and `trigger` defaults to 1 (`:129`, `:323`), so a task row counts |
| only call sites are the sweep + the testing shim | `grep 'redriveBouncedA2a'` → `:347` (sweep), `:470` (def), `:563` (`_redriveBouncedA2aForTesting`) |
| `getBouncedClaims` early-returns when empty | `src/db/session-db.ts:277` selects only the two `bounced-*` statuses; `deleteBouncedClaims` (`:289`) is per-id, never a blanket clear |

**The "should not exist" comment the PR deletes was in fact accurate at the producer.** Both
`markBounced` call sites are hard-gated on `channelType === 'agent'`:
`poll-loop.ts:900` (structured-isError branch) and `poll-loop.ts:525` via `classifyThrownBounce`,
whose first line is `if (channelType !== 'agent') return null` (`:189`). So how does a `channel_type
IS NULL` task row get a bounced ack? **Batch contamination** — `markBounced(initialBatchIds, …)`
marks the **whole batch**, and `extractRouting` (`container/agent-runner/src/formatter.ts:112-120`)
takes `channelType` from `messages[0]` only. A batch whose first row is an a2a handoff and which
also contains a task row bounces *both*; the task row lands with `channel_type NULL`. That is the
real provenance of the prod row, and the PR never states it — its comment change ("a non-a2a bounce
… e.g. a scheduled task") describes the *shape* correctly but not *how the shape is produced*.
⇒ Worth noting: the principled fix might be at the producer (bounce only the a2a rows in the batch),
not only at the reclaimer. The PR's change is still correct and strictly-additive as a reclaimer.

## The regression test does not pin the fix — EXECUTION-CONFIRMED

**The fix is an ORDERING change inside `sweepSession`. `sweepSession` has zero test coverage:**
`grep -c 'sweepSession' src/host-sweep.test.ts` → **0** on both baseline and head (non-zero control:
552 lines in the file), and it is not exported — the only `_…ForTesting` shims are
`_resetStuckProcessingRowsForTesting` (`:438`) and `_redriveBouncedA2aForTesting` (`:557`).

The new test calls `_redriveBouncedA2aForTesting` **directly**, bypassing `sweepSession` and
therefore bypassing the step-ordering that is the entire subject of the PR. What it asserts —
claim cleared, row left `pending` and still due — is behavior the **baseline already had**: baseline
`src/host-sweep.ts:498-503` takes the `row.channelType !== 'agent'` branch, does
`handled.push(message_id); continue;`, and `handled` is what `deleteBouncedClaims` clears at the end
(`:541-548`). All five helpers the test uses (`makeA2aSessionDbs`, `inRow`, `getBouncedClaims`,
`noopDeadLetter`, `fakeSession`, and the shim) pre-exist on baseline; the only new token is the
`task-frozen` fixture (baseline hits: 0).

### ✅ CONFIRMED BY EXECUTION — 2026-08-04, differential run with a positive control

Ran in an isolated `git worktree` at PR head with its own clean `pnpm install --frozen-lockfile`:

| Arm | Sources | Result |
|---|---|---|
| **A** (decisive) | baseline `host-sweep.ts` + PR's new test | **PASS** — `Tests  1 passed \| 34 skipped (35)`, 1 test matched |
| **B** (positive control) | both files at PR head | **PASS** — `Tests  1 passed \| 34 skipped (35)`, harness sound ⇒ A is meaningful |
| **C** (sanity) | whole file at head | `Tests  35 passed (35)` — non-zero total, nothing else broken |

**⇒ The added test does NOT fail without the fix.** It is a valid *characterization* test for the
non-a2a branch, but **not a regression test for the 18-day freeze**: nothing in the suite would catch
a re-reordering of step 1b back to step 4. Prediction upgraded to result; both arms named their
matched-test count, so a 0-matched false pass is excluded.

Runtime corroboration of *where* the two versions actually differ: Arm B logged
`Reclaimed non-a2a bounced claim … messageId="task-frozen"` and Arm A did not — so the only
behavioral delta the test file touches is **the new `log.info` line, which the test never asserts.**
The claim-clearing it does assert was already baseline behavior (`:500-503`).

⚠️**Methodology note that nearly invalidated the run:** the local clone sits on
`kb-wiki-fold-20260804`, an **unrelated lineage** — its `host-sweep.ts` differs from baseline by 363
lines and its `package.json`/lockfile/vitest config all differ. Overlaying the two files onto that
tree would have tested the wrong codebase and produced a confident wrong answer.
⭐⭐**A differential test is only differential if the OTHER files are the baseline's too — verify the
tree's lineage, not just the two files you swapped.** (Full baseline→head diff confirmed as exactly
those 2 files, +68/−5, nothing else.)

**To actually pin this bug** a test would have to drive `sweepSession` with the container reported
down and a due hidden message, asserting the claim is reclaimed rather than suppressed by the wake —
that arrangement fails on baseline; the shipped one cannot.

## Lessons

- ⭐⭐ **A live-PR state read is a measurement with a timestamp, and 13 minutes is inside the race.**
  At 10:36Z: `state=open`, `mergeable_state=unstable`, `ci=in_progress`. At 10:46Z: `merged=true`.
  Nothing was wrong with the instrument; the artifact moved. Same shape as the #11616 unearned-dispatch
  defect. On a self-merging repo, **re-read state immediately before emitting any disposition** — and
  never let a decision drafted at T be delivered at T+n as though it were current.
- ⭐⭐ **A regression test that exercises a helper directly cannot pin a fix that lives in the
  caller's step ordering.** The tell is cheap and mechanical: the changed control flow is in function
  F, and `grep -c F <the test file>` is 0. Run that grep before crediting a PR with a regression test.
- ⭐ **When a PR deletes a "this should not exist" comment, check the producer before agreeing the
  comment was wrong.** Here both producers really do gate on `channelType === 'agent'`; the shape
  arrives via whole-batch marking + first-row routing, which is a producer-side gap the PR leaves open.

## Related

- [[project_nanoclaw_1064_tasks_group_scope_lookup_bug]] — previous human nanoclaw code PR, same
  no-route, also self-merged in minutes
- [[project_nanoclaw_pr874_webhook_route_approver]] — the standing no-route rule and its repo class
- [[project_nanoclaw_kb_sync_pr_autoref_noop]] — bot-data sibling of the same webhook class
