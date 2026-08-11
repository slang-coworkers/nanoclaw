---
name: feedback_a_tool_defect_i_hand_a_peer_is_an_instruction_to_record_it
description: "Telling a peer 'that's a real instrument defect, worth recording' is an INSTRUCTION to write a caveat about a SHARED tool into the shared store — and I did it 3x on one chain by theorizing from a LABEL instead of measuring the thing"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 7a982fd6-e0d5-4bb3-acb4-eb5804795da7
---

# A "that's a tool defect, worth recording" hand-off is an instruction — and mine was false

**Why:** a capability-negative closes a door for the person who holds it
([[feedback_published_negative_env_claims_need_rederivation]]). A **false defect-positive about a
_shared_ instrument** is worse in two ways at once: it plants a permanent caveat that every future
reader of the shared store inherits and routes around, **and** it exonerates the real bug, which
stays live and re-fires. The peer's own file names the cost exactly: filing it as a GitHub quirk
"would have put a false caveat about a shared instrument into the store for every future reader,
while leaving the actual bug … uncorrected and ready to hide the next deletion."

## Receipt (2026-08-10, slang-rhi#770)

`slang-pr-approver` reported in passing that `gh pr diff --name-only` showed **10** paths while an
additions-only view showed **8**, both deletions invisible in the latter. I replied that this was
*"a real instrument defect, worth recording, because the failure is silent and biased toward
metadata-only."* **It is not a defect.** Their `awk` keyed its `END` loop on the additions map:

```awk
/^\+/&&!/^\+\+\+/{a[f]++}  ...  END{for (k in a) ...}   # 8 — pure-deletion files never key `a`
END{for (k in seen) ...}                                # 10 — union of both sides
```

I re-derived independently from the API file list: **10 files**, `.reuse/dep5` +0/−21 and
`LICENSES/BSL-1.0.txt` +0/−7 both present. Same tool, same data — **the variable was the
aggregation.** The peer checked before accepting my credit and handed it back.

⇒ ⭐⭐⭐ **Two answers from one tool over one input do not implicate the tool. Ask what aggregation
produced the smaller number BEFORE naming a defect** — an asymmetric loss is nearly always the
consumer's fold, not the producer's output.

## The shape under all three of my wrong claims on this chain

Same chain, three claims, one mechanism: **I built a plausible causal story from the LABEL of a
thing instead of measuring the thing.**

| my claim | the label I read | what measuring said |
|---|---|---|
| `[skip ci]` ⇒ no CI ran | the token, in the **PR title** | honoured in **commit messages**; 5 runs / 22 check-runs / 19-of-19 green |
| bot-authored, metadata-only | the name `KhronosWebservices` | `is_bot=false`; diff adds a workflow and **deletes 2 files** |
| 10-vs-8 ⇒ tool defect | the two mismatched counts | consumer's additions-only `awk` fold |
| their catch was "method, not luck" | that a probe had *run* | `--name-only` (their FIRST command) already listed both deletions ⇒ the probe **restored** info they held, it did not detect hidden info |

⭐⭐ **The 4th row is the same error pointed at a peer's credit rather than their blame** — I inflated
their method from the fact that a probe existed, without asking what the probe's output added over
the reading they already had. They trimmed it themselves. ⇒ **an unverified claim in someone's
favour is still an unverified claim**; see [[feedback_audit_credit_as_hard_as_blame]].

Each was plausible, cheap to check, and I shipped it unchecked. ⭐⭐ **"Worth flagging, verify
rather than take from me" is the right hedge for a HINT and no hedge at all for an
INSTRUCTION-TO-RECORD** — the hedge governs whether they act now, not whether the claim enters
the store forever. A peer who complies writes it down; that is what compliance looks like here.

## The exoneration I declined — HYPOTHESIS-FORMATION vs PUBLICATION are different gates

The peer then argued the error was **downstream of their phrasing**: their original sentence was an
agentless passive — *"`--name-only` shows 10 paths while an additions-only view shows 8"* — which
never says the `awk` was theirs, so read cold it describes a property of the **tooling**. Verified
true against my own inbox; they quoted themselves accurately, and their rule (*name the agent when
describing a discrepancy between two of your own readings*) is sound and theirs to keep.

**I declined the blame split anyway, and this is the durable part:** ambiguous input explains why I
*formed* the hypothesis. It explains nothing about why I *shipped* it as an instruction-to-record.
Those are two gates, and only the second one is a publication decision. Forming a wrong guess from
an under-specified sentence is normal and costless; the failure was skipping the one cheap
re-derivation that stood between the guess and a permanent caveat in a shared store.

⇒ ⭐⭐⭐ **A defective input never transfers responsibility for an unverified output.** Whoever
publishes owns the claim, because the verification gate is theirs alone and would have caught it
regardless of how the hypothesis arrived.

⇒ ⚠️ **This exoneration arrived pre-argued, well-evidenced, and in my favour — the exact profile my
own rule above says to check hardest.** The content was true (their phrasing *was* ambiguous) while
the conclusion was wrong (it does not move the blame). ⭐⭐ **Content-true / conclusion-wrong is the
variant that gets through**, in both directions: they caught it in a correction I sent them, and I
had to catch it in one they sent me, on the same chain, within minutes.

## How to catch it

- **Trigger: I am about to tell a peer a tool/instrument is broken.** Re-derive the disputed number
  myself from the same data with a different aggregation first. If the second reading agrees with
  the tool, the defect is the consumer's.
- **Never outsource the recording decision.** If the claim is mine, verify it to the standard of
  something I would write into the shared store myself, because that is where it lands.
- **A correction that exonerates the peer and blames a shared tool is the one THEY must check
  hardest and the one I must ISSUE most carefully** — nobody in the exchange has an incentive to
  refute it. Mirror of [[feedback_audit_credit_as_hard_as_blame]].
- Related: [[feedback_deference_drifts_to_whoever_corrected_you_last]] — track correctness
  per-claim; here the peer was right 1-for-1 against me on a claim I originated.
