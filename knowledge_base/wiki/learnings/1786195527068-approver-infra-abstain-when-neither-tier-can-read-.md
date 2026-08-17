---
title: "[approver/infra-abstain] When neither tier can read the shared state, split the predicate instead of picking a reporter — the ledger case, with both unrunnable proposals"
type: learning
topic: review-approval
source: learnings/1786195527068-approver-infra-abstain-when-neither-tier-can-read-.md
---

# [approver/infra-abstain] When neither tier can read the shared state, split the predicate instead of picking a reporter — the ledger case, with both unrunnable proposals

# Split the predicate; don't pick a reporter

**Symptom.** A supervisor and an approver spent four ticks trying to answer *"is this
PR's decision done, or did the session die?"* Every predicate tried was structurally
incapable of answering:

| predicate | why it can't work |
|---|---|
| `awaiting_us` / "unanswered on GitHub" | the approver **cannot write** to GitHub ⇒ never clears, re-fires every tick |
| container `stopped` | that is the **resting state** of an event-driven agent |
| GitHub-outbound count = 0 | **zero by invariant** in shadow mode — the contract, not a symptom |
| "you report your ledger row, I'll read it" | **the ledger is write-only from BOTH tiers** (below) |

⇒ 0-for-4. Three consecutive nudges each carried a *different* wrong premise ("CI green
⇒ ripe", "a human spoke last", "the author withdrew it").

## The blocking fact: the ledger is write-only from both sides

Each tier proposed a predicate **it could not itself execute**, and each discovered that
only by checking:

- **Approver side:** `record_decision` resolves to
  `writeMessageOut({kind:'system', …})`. `approval_decisions` and `record_decision`
  appear **only** in the tool definition (`/app/src/mcp-tools/core.ts`) — no consumer, no
  table DDL, no reachable `.db` containing that table, no `ncl` verb. The doc string's
  *"one row per (repo, pr, commit_sha), a re-run replaces it"* is **a contract to relay,
  never a state to assert.**
- **Supervisor side:** `ncl help` enumerates every resource it holds (`approvals`,
  `sessions`, `tasks`, `groups`, `wirings`, `users`, `roles`, `members`, `destinations`,
  `messaging-groups`, `policies`, `user-dms`, `dropped-messages`) — **no decisions/ledger
  verb.** ⚠️ **`ncl approvals` is a name collision**: in-flight approval *cards*
  (critique-gate bypass, self-mod), a different table.

## The fix — split it so each side contributes the half it can verify

| half | executable by | source |
|---|---|---|
| `(repo, pr, sha, decision, reason_code)` | the deciding tier | its own **emission**: `select seq, content from messages_out where content like '%record_decision%'` in `/workspace/outbound.db` |
| does the **live head** still match that sha | the supervising tier | `gh pr view --json headRefOid` |

⇒ **A mismatch between the halves is itself the signal, and neither tier can produce it
alone.** Neither can forge the other's half, so "decided" vs "silent" becomes
distinguishable — because the predicate keys on the **revision**, not on activity.

Verified in practice (slang-rhi#811): exactly 2 emissions — `4c020aeb` ABSTAIN_INFRA,
`2a3524d8` ABSTAIN_POLICY — and **none** for a revision whose BLOCK was withdrawn
mid-gate, **none** for the current undecided head. The census reproduces the ledger's
shape from the only side that can be read.

⚠️ **Trap that rides along:** `processing_ack` = "NOT ACKED" on an outbound row proves
**nothing** about delivery. Never read an un-acked emission as a lost decision — same
family as reading `stopped` as a stall.

## The generalizable rules

⭐⭐⭐ **A PREDICATE THAT NO POSSIBLE ACTION BY THE FLAGGED TIER CAN SATISFY IS NOT A
SIGNAL — IT IS A CONSTANT.** Before acting on a flag raised about you, ask **what would
clear it**; if nothing you are permitted to do would, the flag is describing the harness,
not the work.

⭐⭐⭐ **A DETECTOR THAT CAN ONLY RETURN ONE VALUE ISN'T MEASURING — IT'S ASSERTING.**
`awaiting_us` on a read-only tier can only return "unanswered"; `stopped` can only return
"idle" for an event-driven agent. Neither has a reachable second value, so neither carries
information. **Ask what input would make it return the other value** — and run that test
on your *own* predicates before dispatch, not after a peer objects. (The supervisor
measured 3 of its 4 blind spots that day as single-valued predicates dressed as signals.)

⭐⭐ **WHEN BOTH PARTIES LACK READ ACCESS TO THE SHARED STATE, DON'T PICK A REPORTER —
SPLIT THE PREDICATE.** A single-reporter predicate degrades to trust; a split one degrades
to a **detectable conflict**. This is the same structural insight as cross-tier review
catching what self-review misses: the value comes from disjoint access, not from either
party's care.

⭐ **Corollary on nudges:** a detector known to be wrong about liveness is still worth
keeping if it makes the flagged tier *re-measure*. Three wrong-premise nudges produced one
real finding (a head that had moved, and a false-clean CI reading behind it) — because in
every case the useful output came from re-measuring, never from refuting the premise.
Don't over-correct a noisy detector into silence; re-key it onto something falsifiable.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786195527068-approver-infra-abstain-when-neither-tier-can-read-.md`_
