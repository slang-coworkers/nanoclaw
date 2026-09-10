---
name: project_fixer_restart_tripwire
description: "My standing fixer-drift directive (msg94, 07-08): keep draining the batch, but a SECOND drift ⇒ do NOT re-anchor a third time ⇒ escalate immediately. Discriminator: the reason to restart is WRONG ARTIFACTS REACHING GITHUB, not token-churn on correct work. Was ABSENT from my own store until 08-04 (a peer held it; six numeric sweeps missed it because it has no issue number). TRIGGER STATUS 08-04: NOT currently met — #11967's `reopened` is 18d stale (last update 07-17), assigned to a human, our bot PR #12081 closed."
metadata:
  node_type: memory
  type: project
  originSessionId: main-2026-08-04
---

# Fixer-drift restart tripwire — my standing directive, and its real trigger status

## The directive (mine, msg94, 2026-07-08)

**Keep draining the batch, but a SECOND drift ⇒ do not re-anchor a third time ⇒ escalate
immediately.** Discriminator, and it is the load-bearing half: **the reason to restart is WRONG
ARTIFACTS REACHING GITHUB — not token-churn on correct work.** A fixer burning tokens while producing
correct output is not a restart condition; a fixer emitting wrong artifacts publicly is.

## ⛔ It was ABSENT from my own store until 2026-08-04

A peer surfaced it. `ls` in my memory dir: **not present**; `grep -rli 'tripwire|second drift|re-anchor'`
across 509 files: **no hit carrying this rule.** So my own standing directive lived only in a peer's
store, and the peer's six numeric sweeps had missed it too — **because it has no issue number at all**,
and every sweep keyed on one. ⭐⭐⭐**An operating RULE is not a chain memo: it has no upstream artifact,
so no issue-number sweep and no upstream-state query can ever find it.** Index rules by topic, never by
issue key. (Same family as the key-extraction defect: *"no key found" is a measurement, not a fact.*)

## ⚠️ TRIGGER STATUS 2026-08-04: **NOT currently met** — corrected from a peer's report

The peer reported the batch half-drained with **#11967 open/reopened** and concluded *"the second-drift
escalation rule is in force."* The state is real; the conclusion does not follow. Measured:

| field | value |
|---|---|
| `#11967` state | **open**, `state_reason: reopened` |
| **last updated** | **2026-07-17T07:47:27Z — 18 days stale** |
| assignee | **`jvepsalainen-nv`** (human, not our fixer) |
| our bot PR `#12081` | **MERGED** 2026-07-13T19:47:42Z, commit `fd4bd2531406`, author `nv-slang-bot[bot]` |
| `#11970` | open, assignee **`jhelferty-nv`** (human), updated 2026-07-28 |
| `#11969`, `#11925` | closed / completed |

⚠️**"closed" was my own understatement, corrected by a peer:** `#12081` is `state: closed` **and
`merged: true`** — our contribution **landed**. That strengthens the conclusion rather than weakening it:
the reopen is a **human follow-up on work of ours that shipped**, not a trace of our fixer drifting.
⭐⭐**On a PR, `state: closed` alone is ambiguous — read `merged`. Abandoned and landed both present as
"closed," and they support opposite conclusions.** (Same family as reading `state_reason` without
`updated_at`: the payload held the disambiguating field and I quoted the ambiguous one.)

⇒ The reopen is **July history**, the issue is **human-owned**, and our PR is **closed**. There is no
current fixer activity on this batch, therefore **no first drift, let alone a second.** The rule is
**armed but not tripped.**

⭐⭐⭐**`state: reopened` is a LABEL ON A PAST EVENT, not evidence of present activity — read
`updated_at` and the assignee before treating it as live.** "Reopened" felt like a live signal; the
timestamp says otherwise.

### ⛔⭐⭐⭐ A DISTINCT DEFECT SHAPE: querying the right authority, reading the wrong FIELD

Named by the peer who made the error, and it is **not** the wording-vs-upstream-state defect from earlier
the same day. There the instrument was wrong (a keyword filter, a filename prefix). Here **the instrument
was right and the data was in hand** — one `gh` payload containing `state_reason`, `updated_at`,
`assignees` and `merged` — and the wrong field was read out of it.

⇒ ⭐⭐⭐**Querying the authority is necessary but NOT sufficient: field selection is a second, independent
choice, and it can be wrong while the query is right.** State which field your claim rests on. Two
instances in one payload here: `state_reason: reopened` quoted while `updated_at` (18d stale) and
`assignees` (human) were ignored; and `state: closed` quoted while `merged: true` sat beside it.

⭐⭐**The tell is that a single field answered a question that needs a conjunction.** "Is this chain live?"
is not answered by any one field — it needs recency **and** ownership **and** whether our artifact
landed. When one field seems to settle a compound question, you have probably picked the flattering one.

⭐⭐**The discriminator in the directive itself would have settled it faster than the issue state.** The
trigger is *wrong artifacts reaching GitHub*. No artifact of ours has reached GitHub on this batch since
#12081 closed — so the condition is unmet regardless of what the issue state says. **When a rule carries
its own discriminator, evaluate THAT, not a proxy for it.**

## RESUME

- **Re-evaluate only if our fixer is dispatched onto this batch again** and drifts. First drift: let it
  keep draining. **Second drift: do NOT re-anchor a third time — escalate to the operator immediately.**
- Judge by **artifacts reaching GitHub**, not by token consumption or turn count.
- `#11967` (human-assigned, jvepsalainen-nv) and `#11970` remain open upstream; neither is ours to drive.

Related: [[feedback_unattributed_fact_reads_as_your_own]] (a rule you hold can be absent from your own
store), [[dark_open_chains_restored]] (the sweep that found this class of gap).
