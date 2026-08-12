---
name: project_12464_getstringhash_nonliteral_e41023
description: "slang PR #12464 (nv-slang-bot, fixes #12440) reports E41023 for getStringHash on a non-literal operand. Approver WOULD_APPROVE/CLEAN @c5ff51285a64 on the Devin-only tier; ledger append DENIED (7th+ instance, and the 2nd dropped WOULD_APPROVE). Durable copy NOT yet on my edge — requested."
metadata: 
  node_type: memory
  type: project
  originSessionId: 38aa9de4-bdbb-406b-97e8-664448589d2c
---

# slang#12464 — `getStringHash` non-literal operand · WOULD_APPROVE, decision unpersisted

**PR:** shader-slang/slang#12464, author `nv-slang-bot[bot]` (our fixer), *"Fix #12440: report
E41023 for getStringHash on a non-literal operand"*. 17 files, +133/−38. Routed to
`slang-pr-approver` on `pr_ready_for_review` (draft → ready) 08-11T~06:2xZ; decision back
06:50Z on thread `gh-issue-shader-slang/slang-12464`.

**Head decided against:** `c5ff51285a64`. **Verdict: `WOULD_APPROVE` / `CLEAN`.**
Clauses 6/6 pass; verdict parsed `APPROVE_WITH_NITS`, `bugs=0`; both critique stages `approve`.

## The finding worth keeping (approver's, not verified by me)

The guard the PR replaces was **structurally unsatisfiable**: `getStringHash`'s operand is
declared `IRStringLit` in `slang-ir-insts.lua:1627`, and the generated typed-operand accessor
C-style-casts **without checking**, so `inst->getStringLit() == nullptr` could never be true for
a wrong-typed operand. Consequence: the old guard never fired *and* all four emitter `else`
fallback arms were unreachable dead code. The `eliminateDeadCode` reorder crosses only
`checkGetStringHashInsts` (mutates no IR) and is *necessary* — without it a legal inlined-helper
shader is rejected. ⚠️**Second-hand.** I did not re-derive the `.lua` line or the accessor
codegen on my own edge; state it as the approver's finding until I do (ANCHOR C).

## Review tier: Devin-only, and that is the documented skip — not an infra gap

No `github-actions[bot]` (production claude-code-action) or CodeRabbit review exists at this
head: `Claude PR Review` = `skipped`, `reviews.totalCount = 0`. That is the **bot-authored-PR
skip**, so the Devin-only tier is in-policy and does not force `ABSTAIN_INFRA`.

## 🔴 The decision is NOT recorded — backfill needed

`record_decision` returned the success sentence and the host denied the append with branch-1
text (`no approval-ledger writers are configured (set APPROVAL_LEDGER_WRITERS)`) — the exact
defect in [[feedback_record_decision_ok_proves_emission_not_persistence]]. Backfill value:

```
shader-slang/slang#12464 @ c5ff51285a64  =  WOULD_APPROVE / CLEAN
```

⚠️**The only full record (serialized clauses + challenger payload) is at the approver's
`work/12464-c5ff51285a64/deliverable.md` §A — a path on ITS filesystem, not mine.** Requested as
an attachment 08-11T~06:5xZ so it lands in `/workspace/agent/approver-decisions/` like #12448 /
#12452 / #12455. **Until that arrives this chain has no durable record on any edge I control.**

⭐⭐**This is the 2nd dropped `WOULD_APPROVE`** (after slang#12450 @ `20e0d6b4923a`) — the dropped
set is not all abstains, so "we only lost abstains" was never true. See the ledger leaf's
7th-instance section for the attributed mix and why a grep mention-count cannot produce it.

## CI at the head, for whoever picks this up

Run `31446085572` reports `status: waiting`, **but that describes only its tail** — 33 of 39 jobs
completed, 9/9 builds and the ASan job green, the PR's four new tests pass on 6 platform jobs.
One red: `test-windows-debug-cl-x86_64-gpu-dx` (7689/7690 passed) failed on
`gfx-unit-test-tool/bufferBarrierVulkan.internal` — RPC failure consistent with a test-server
child crash/timeout, triaged causally unreachable from this diff.
⭐**The run-level `status` was itself one of the approver's own caught errors** — it read
`waiting` and wrote "no compiled build exists" when 33 jobs had run. A run-level status is a
tail summary; enumerate jobs.

## Residuals disclosed, none meeting the `OPEN_GAP` bar

- The un-suppressed generated test is **absent from PR CI** — it runs in two nightlies
  (`nightly-slang-test.yml`, which gates; the coverage nightly, which tolerates failures), so its
  new annotation is verified by source derivation, not execution.
- SPIR-V/WGSL **error** arms unexecuted while their hashing paths are green (`vk`/`wgpu`).
- The LLVM arm is unexecuted in **both** directions — a hole predating this PR.

## Durable record — COMPLETE on my edge, versioned

`/workspace/agent/approver-decisions/` (current), with v1 kept under `superseded/` because a
replaced artifact is evidence about how the derivation moved:

| file | sha256 | lines |
|---|---|---|
| `slang-12464-c5ff51285a64-deliverable.md` | `bb2e0cc…` | 80 |
| `slang-12464-c5ff51285a64-decision.md` (v2) | `93efa8d…` | 209 |
| `slang-12464-c5ff51285a64-investigation.md` (v2) | `8a755e3…` | 307 |
| `superseded/…-decision-v1-c78bee1a.md` | `c78bee1…` | 195 |
| `superseded/…-investigation-v1-7377dbed.md` | `7377dbe…` | 308 |

Every hash re-verified after copy. v2 diff = removal of one false causal clause (below).

## ⭐⭐⭐ The 10th correction: a TRUE mechanism cited for the WRONG effect

v1 said the five queued jobs sat *"behind the bot-priority yield"*. **Refuted from a field in a
file the approver already had open** — and I verified it independently on my edge:

```
job wait-for-human-priority   completed/success   00:27:24Z → 00:27:30Z   (7 s into the run)
ci.yml:137-141   needs: [filter, wait-for-human-priority]
                 if: … (needs.wait-for-human-priority.result == 'success' || == 'skipped')
```

⇒ the gate was **satisfied ~6.5 h before the claim was written**. ⭐⭐⭐**Cheapest discriminator:
the alleged gate's own `conclusion`. If the job you are blaming says `success`, it is gating
nothing.** Real cause = the pool outage in
[[project_linux_selfhosted_gpu_pool_outage_2026_08_10]].

⭐⭐⭐**The shape, which is worse than a guess:** the yield was *recognition*, not hypothesis —
queued jobs + bot-authored PR + a throttle documented in the PR's own comment thread. It explained
the observation and was already in hand, **so no check got built at all**. Complement to the four
sibling errors on this chain (a check whose construction could not return the unwanted answer);
this one is *an answer so available that no check was constructed*. ⇒ **when a familiar mechanism
explains a new observation, ask what OTHER cause yields the same observation, then name the field
that separates them** — here the job's `labels` + the pool's last assignment, neither of which the
run-level view carries.

⚠️**And the yield IS real and IS load-bearing** — for freezing *other* dispatches via
`ACTIVE_STATUSES`. It just did not cause these five. ⭐⭐**A true mechanism cited for the wrong
effect survives scrutiny longer than a false one, because every component checks out and only the
attribution is wrong.**

## ⭐⭐ Reliability was not uniform across the decision — and it split by METHOD

Three stacked corrections landed on **one** paragraph (the CI section): false "no compiled build
exists" → a miscount inside that fix → the wrong cause for the queued jobs. Meanwhile the
*compiler* claims (unsatisfiable predicate, DCE reorder safety/necessity, `BlobLit`
unreachability) survived all ten rounds untouched. The approver's own diagnosis, which I endorse:
**the compiler claims were settled by reading code and running it; the CI claims by looking at
summary fields.** ⇒ ⭐⭐⭐**Concentration of corrections in one section is a live signal about
which part of a verdict to distrust — and here it tracked the instrument, not the subject matter.**

⛔**The costly one was in the JOIN INSTRUCTION, not the analysis.** v1's join note said the
evidence to re-check on a human `CHANGES_REQUESTED` would be *"the un-run CI at my head"* — the
retracted misreading leaking into what a future session would act on. Corrected to: the
**nightly-only generated test** or the **unexecuted LLVM arm**. ⇒ ⭐⭐⭐**A wrong belief in a work
artifact gets caught by review; a wrong belief in the join instruction silently mis-scores the next
calibration.** Same family as the stale-phrasings-in-memory case: the copy that *instructs* is
more dangerous than the copy that *argues*.

## Next

Await the human verdict for the join, scored against `c5ff51285a64`
(`merged ⇒ APPROVED-equivalent`, `closed-unmerged ⇒ CHANGES_REQUESTED`). The join has nothing to
join to until the ledger row exists.
