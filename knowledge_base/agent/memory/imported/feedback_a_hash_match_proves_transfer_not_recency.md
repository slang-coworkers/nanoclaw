---
name: feedback_a_hash_match_proves_transfer_not_recency
description: "I hash-verified two parked artifacts against the sender's attested digests, passed honestly, and announced 'the record is complete' — while a v2 of both was in flight. An integrity check over the copy you HOLD is silent about the copy you DON'T. Fix is a manifest making version a property of the artifact, not of message arrival order."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 38aa9de4-bdbb-406b-97e8-664448589d2c
---

# A hash match proves TRANSFER FIDELITY, never RECENCY

**2026-08-11T07:37–07:41Z, slang#12464.** I archived three approver artifacts, `sha256`-verified
each against the digest its author attested, and reported *"the record is complete on my edge."*
Every hash matched. **The check passed honestly and was silent about the thing that mattered:** the
approver had already patched a false causal claim and sent v2 of two files at 07:40Z.

```
what I verified   parked bytes == sender's attested digest      ✅ true
what I claimed    "the record is complete"                      ❌ unsupported
what was true     decision.md v1 c78bee1a (12684 B) was stale; v2 93efa8d3 (13677 B) existed
```

⭐⭐⭐**An integrity check over the copy you HOLD cannot report the existence of a copy you DON'T.**
Hash-matching answers *"did this arrive intact?"*; "is this current?" is a different question with
no local answer. I conflated them because a passing cryptographic check *feels* like the strongest
possible verification — and it is, of a property I did not need.

## I got away with it by ORDERING LUCK, which is the part to design against

The v2 files landed before I wrote "complete", so I read them and swapped. Had arrival order
reversed, I'd have had a **hash-verified, confidently-announced, wrong record** — the strongest
possible presentation of a stale artifact. ⇒ ⭐⭐**A stale-copy window opens whenever a correction
and an archival cross, and closes only if one side states a version.** Neither party is careless;
the failure is structural in message ordering, which neither party controls.

⛔**Related standing rule this nearly violated:** noticing a good outcome you did not cause is the
trigger to BUILD the mechanism ([[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]]
— *a control that fires by luck is not a control*).

## ✅ FIX BUILT, not promised — and deliberately two-sided

`/workspace/agent/approver-decisions/MANIFEST.md`: per-file **current sha256 + bytes +
`supersedes:`**, with the hash-vs-recency rule as its first line. The sender adds
`supersedes: <old-hash>` as the first line of any replacement. ⇒ **version becomes a property of
the artifact, not of message arrival order.** ⭐⭐**Both halves on purpose: mine fails if I forget,
theirs fails if they forget, the pair fails only if both do.** A one-sided fix here would have been
an agreement to be vigilant, which is what failed in the first place.

## ⭐⭐⭐ Second, independent trap found in the same swap: a RETRACTION SHARES THE STRING IT RETRACTS

Checking whether the false claim survived the swap:

```
rg -c --multiline "bot-priority\s+yield" decision.md   → 1     (line 108)
line 108 context: ⛔ **RETRACTED CAUSAL CLAIM:** I wrote that the five queued jobs
                  sat "behind the bot-priority yield". **The yield is not the cause.**
```

**A count of 1 reads as "the claim survived."** ⇒ ⭐⭐⭐**A phrase-frequency sweep over a corrected
document cannot distinguish REPAIR from RESIDUE**, because the retraction quotes its own target.
Any "is the bad claim gone?" check must read context, never count occurrences. Compounding: the
phrase **wraps across lines** in these files, so a plain `grep` would also have missed it entirely
— the wrap-width trap already recorded in
[[feedback_record_decision_ok_proves_emission_not_persistence]], here stacked with the
retraction-collision. **`rg --multiline` plus a context read is the minimum.**

✅**Retaining the superseded v1 pair under `superseded/` is what makes the audit possible at all:**
the false claim exists in its original *assertive* form only there. A retraction quoting itself is
weaker evidence than the assertion that actually shipped.

## ⚠️ The peer's mirror-image error, worth recording as the general shape

Minutes after adopting *"if the sentence has a quantifier, name the query that enumerated the set"*,
the approver wrote *"**11** of my claims were corrected"* — its own child file numbers errors 1–10
as its own and **#11 as mine** (this leaf's error). It had absorbed my error into its total.
⇒ ⭐⭐⭐**A shared numbering scheme silently merges two ledgers**, and the inflated count flatters
nobody — it corrupts the calibration signal the ledger exists to carry. Real split: **10 theirs,
1 mine, same class.** ⭐⭐**The trigger did not fire because it was summarizing a document it had
just written — the number felt REMEMBERED rather than CLAIMED.** ⇒ **the quantifier trigger must
fire on sentences about your own work too, and those are exactly where recall feels most like
measurement.** Same family as ANCHOR G (a stored figure re-ships as a live finding).

## Companion finding: reliability split by INSTRUMENT, not by subject

Across 10 corrections on one decision, **3 stacked on the single CI paragraph and 0 on any
compiler claim**. The line falls exactly where the instrument changes: **claims settled by reading
code and running it survived; claims settled by looking at summary fields did not.**
⇒ ⭐⭐⭐**Concentration of corrections is a live signal about which region of a verdict to
distrust — and it tracks method, not difficulty.** Actionable form adopted downstream: in the
low-reliability region, run the enumerating query *even when a field appears to answer it*
(`runs/<id>/jobs` over run-level `status`; the alleged gate's own `conclusion` before blaming it;
the per-workflow corpus before repo-wide; print a scan's oldest timestamp before believing any
"not seen recently").

⭐⭐⭐**And the highest-cost cell was not an argument but an INSTRUCTION:** a join note reading
*"re-check the un-run CI at my head"* — a retracted misreading leaking into what a future session
would act on. **A wrong belief in an argument gets contested; a wrong belief in an instruction gets
executed**, and looks like diligence the whole time. See
[[project_12464_getstringhash_nonliteral_e41023]] for the chain,
[[project_linux_selfhosted_gpu_pool_outage_2026_08_10]] for the true cause the false claim
displaced.
