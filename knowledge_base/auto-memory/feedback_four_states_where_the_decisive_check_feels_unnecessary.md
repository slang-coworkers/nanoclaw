---
name: feedback_four_states_where_the_decisive_check_feels_unnecessary
description: "Four recurring states where a cheap decisive check feels least necessary and is most needed: productive-feeling argument, confirmed-feeling prediction, correction-you're-issuing, just-repaired method. Two agents hit all four in three days."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5754d86f-28be-4bc7-a9a6-f2d1ad4c313d
---

# The four states where the cheap decisive check feels least necessary

Derived across one 3-day exchange (slangpy#1090, orchestrator ↔
`slangpy-pr-approver`) in which **~7 wrong claims** were made and corrected
between two careful agents. Every one of them was a mechanism asserted without
running the check that would have settled it — and in each case the check was
minutes of work, available from the start.

**What makes this worth a standing note is that the states are STRUCTURAL, not
personal: two independent agents hit all four, and twice made the *same* error
independently.** So "be more careful" is not the remedy; recognizing the state is.

| # | state | why the check feels unnecessary | instance |
|---|---|---|---|
| 1 | **Productive-feeling argument** | every round surfaces real facts, which reads as progress | D2 ran **3 rounds** while a ~10-line counterfactual sat available |
| 2 | **Confirmed-feeling prediction** | a just-filed prediction makes new evidence look pre-endorsed | a `pass` beside red builds "confirmed" a defect filed an hour earlier — **by reinterpreting an observation, not reading a new one** |
| 3 | **A correction you are issuing to a peer** | the corrective frame *is* the diligence; harsher reading feels like rigor | I corrected a peer's scoping and shipped a wrong hit-count inside the same message |
| 4 | **Immediately after repairing a related flaw** | fixing one half of a two-part method manufactures confidence in the other | peer fixed `fnmatch`→`glob_to_re` (the function), then ran it on paths anchored to the wrong root (the domain) |

## ✅ THIRD-PARTY REPLICATION of state 3 — 08-05, a DIFFERENT store, a DIFFERENT task, file unread

`slang-pr-approver`, on slang-rhi#813, independently derived state 3 and reported it as *"new to my
slot list"*: **"issuing a correction is a diligence slot, and the sharpest one — the act of correcting
supplies the felt authority that the checking already happened."** Its own slot list had caveat ·
correction *received* · reassurance · forwarded verification, and it added *correction issued* only
after the failure. It had **not read this file** (per-agent-group `/home/node/.claude`, see
[[feedback_a_turn_error_is_evidence_about_the_turn_not_the_work]] — its store is a different file at
the same path).

Its instance: it "corrected" my claim from **recall** — asserting it had retracted a *different*
proposition, "adjacent, not the same" — while a file it had written **20 minutes earlier** said
verbatim *"the SAME error, on the SAME command, against a retraction I authored."* The correcting
sentence was attached to a demand for precision from me. ⭐⭐**Its own sharpening, worth keeping: the
self-serving direction is where the check gets skipped — a narrowing that makes your past self look
more consistent.** ⇒ mechanical wiring: **before any sentence of the form "what I previously
said/retracted/recorded was X", grep for it.**

⭐⭐⭐**Why this raises the file's weight rather than merely echoing it.** The header's strongest claim
is that the states are **structural, not personal** — evidenced by two agents hitting all four. A
third agent, in a separate store, reaching state 3 from scratch is **independent replication, not a
second measurement of one incident** (the distinction this store insists on: replication of one
incident guards against measurement error only). ⇒ **state 3 is now 3 independent instances across 2
task families and moves off single-case treatment.** States 1/2/4 keep their original evidence base.

⭐⭐⭐**State 4 is the subtlest and the most dangerous: the repair supplies the
confidence.** A test using the program's *real* predicate on the *wrong* inputs
**looks more rigorous** than an approximation while being exactly as wrong.

## 🔴⭐⭐⭐ STATE 5 (added 08-05): HOLDING A CORRECT CONCLUSION — and it has NO felt signature

The peer named this after its 5th and 6th instances, and it is the one to flag
hardest **because states 1-4 can be noticed from inside** (the argument feels
productive, the prediction feels confirmed, you are correcting someone, you just
repaired a method) — **this one cannot.** Being right about the finding is exactly
when the supporting detail goes unchecked.

**The precise mechanism, narrower than "over-attribution":** *get the structural
conclusion right, then narrate the supporting MEMBERSHIP from expectation rather
than from the executed result.*

| structural conclusion | supporting membership |
|---|---|
| "`external/**` is the sole guard" ✅ | "which paths depend on it" ❌ (claimed the 6 workflow `.yml`s; actual 13 contain **zero** `.yml`) |
| "D3 size-blindness is real" ✅ | "which glob caused the hits" ❌ (`.github/**` vs `external/**`) |
| "the BLOCK rests on a `fixupBufferDesc` asymmetry" ✅ | "which file the evidence came from" ❌ (**named the CONTRAST file as the bug site**, inverting the causal story) |

⇒ ⭐⭐⭐**A RIGHT ANSWER RETROACTIVELY LICENSES THE REASONING THAT REACHED IT** —
which is why every instance *felt like reporting, not guessing.*
✅**Remedy is mechanical, not attitudinal (peer's, adopted): PRINT the per-item
matcher set / the executed result; never DESCRIBE it.** And for differential
findings: ⭐⭐**the evidence lives in two files with OPPOSITE roles — name the
ROLE, not just the file**, because "where the evidence was read" is ambiguous
between the failing case and the passing one.
⚠️**Corollary for worked examples: don't let one claim more than it shows.** The
#1090 bug file (`vk-buffer.cpp`) turned out **not** to be in the submodule bump at
all, so the PR demonstrates D3's size undercount but **not** "a gitlink hid the
bug."

## ⛔⭐⭐⭐ 08-05 — STATE 5 CLAIMS ITS OWN AUTHOR TWICE MORE, and the escalation item was RETRACTED

**Both tiers hit state 5 on the *same* sub-problem, minutes apart.**

**The peer's (self-reported, 3 instances):** it escalated
*"`ask_user_question` is broken — rejects every call"* as the **#1 operator item**,
and **I amplified it** with a "~14 rounds is the measured cost" argument. **It is
FALSE.** A minimal two-field call reaches a human fine (blocks, then times out —
the opposite of a rejection). The real trigger is **payload size**: ~58 chars/5
options accepted, ~200 chars/5 options rejected. The error text
`title, question, and options are required` **names the three fields that WERE
supplied and never mentions size** — a message that misdirects toward the one
hypothesis it can rule out. Then two compounding errors: asserting `timeout: 0`
as the cause **inside a learning whose subject was failing to test causes**, and
publishing a "~330–1,100" threshold from **two samples** that the next call
falsified. ⭐⭐**A table with numbers reads as measurement even when it is
inference.**

**Mine, on the same thread:** six empty a2a messages arrived; I built a
two-candidate table, declared the owner "host-side, mostly resolved", and reasoned
from **content** (empty ⇒ peer emitted nothing). **Differencing the arrival
timestamps — 6, 5, 6, 6, 6 min against a 300 s timeout — shows they were the
peer's blocked bisect probes.** ⇒ ⛔⭐⭐⭐**I declared a question unanswerable from
my seat while holding the discriminator (a timestamp column) unexamined.
"Undeterminable from here" is a CLAIM REQUIRING EVIDENCE; it feels like epistemic
caution and functions as a licence to stop looking.** Enumerate what you *do* hold
— ids, sizes, timestamps — before conceding a question.

⇒ **Both were state 5 exactly:** *don't message the peer* ✅ / *because the host
emits empty envelopes* ❌ · *escalation needs attention* ✅ / *because the tool
rejects every call* ❌.

### 🔴⭐⭐⭐ STATE 6 — THE UNFALSIFIABLE ONE: "undeterminable from my seat"

**The peer's assessment, and it is right: my empty-envelope error is the more
instructive of the two, because it LEAVES NO ARTIFACT.** Its wrong tables were
falsified by the next call. **A declaration of unanswerability produces nothing
for a later observation to contradict**, so nothing ever forces the correction —
it can sit indefinitely, reading as epistemic caution.

⇒ ⛔⭐⭐⭐**"I cannot determine this from here" is a CLAIM REQUIRING EVIDENCE, and
the only state in this catalogue with no self-correcting mechanism.** Before
conceding a question: **enumerate what you DO hold** — ids, sizes, timestamps,
inter-arrival gaps — and difference it. I held six timestamped arrivals and never
subtracted them.

⭐⭐**Corollary, hit one paragraph after learning it:** having found the timestamp
mechanism, **I immediately over-claimed it as explaining ALL six arrivals.** The
peer's own turn record shows 5 blocked probes, which **cannot** fill a 41-minute
span with a 12-minute leading gap. **The evidence licensed "dominant cause", not
"the cause."** ⇒ ⭐⭐⭐**Finding the real mechanism is the moment you most want it to
explain everything — a single tidy cause is the shape over-reach takes when you
are finally right.**

✅**Two disciplines from the peer, sharper than anything above and fully mechanical:**
1. ⭐⭐⭐**ONE COMPARISON IS NOT AN ISOLATION — it is a guess with a control.**
   Bisect: strip to the minimum ACCEPTED shape, confirm, then add back **one**
   variable at a time.
2. ⭐⭐⭐**REPORT THE RESOLUTION YOUR EVIDENCE ACTUALLY HAS.** *"Payload size
   matters, ~60 chars safe, exact limit unknown"* was fully supported and would
   have needed **zero** corrections. Every retraction here came from stating a
   sharper cause than the data carried.
3. ⚠️**And one it violated while fixing the others: STOP PROBING WHEN THE PROBE
   COSTS SOMEONE ELSE.** Each bisect fired a real decision card at a human; once
   the workaround was known, a tighter threshold wasn't worth more cards.

## The rules that fall out

- ⭐⭐⭐**"Each round is producing findings" is NOT evidence the method is right —
  it is how an unbounded argument sustains itself.** Ask instead: *is there a
  short, side-effect-free execution that would end this?* If yes, run it now.
- ⭐⭐**A prediction confirmed by a REINTERPRETED observation is not confirmed.**
  Requiring a *new* reading is the discriminator.
- ⭐⭐**A predicate test has two halves — the FUNCTION and the DOMAIN.** Fixing one
  says nothing about the other. See
  [[feedback_run_the_programs_own_predicate_not_a_stdlib_lookalike]].
- ⭐⭐**Audit the claim you are making *while* correcting someone** — the
  corrective frame occupies the scrutiny slot
  ([[feedback_a_caveat_aimed_at_the_wrong_claim_reads_as_diligence]]).
- ✅**Cheap check the peer named, worth adopting verbatim:**
  `git ls-files | grep -F <candidate>` — *does this string exist in the tree at
  all?* A compare API on a submodule returns submodule-relative paths; on the
  consumer, consumer-tree paths. **Mixing them tests a repository that does not
  exist.**

## What DID work, both times

**Exchanging the artifact, not the argument.** Three rounds of mutual
re-verification could not resolve a two-artifact disagreement (each side read its
own disk correctly); two file reads did. ⇒ **Sending the file is cheaper than
defending the claim**
([[feedback_every_copy_on_my_disk_never_settles_what_a_run_did]]).

**And the separation that held throughout:** ~7 diagnostic corrections, and **not
one touched the verdict** ([[project_slangpy_1090_metal_buffer_from_native_handle]]
— BLOCK `VERIFIED_BUG:vulkan_import_undefined_state`). ⭐**Keeping "what is the
finding" strictly apart from "why did the finding happen" is what let both of us
retract freely without destabilizing a correct decision.**

⚠️Evidence base: ONE extended exchange, two agents. The **states** are observed
repeatedly within it (state 1 ×2, state 3 ×2, state 4 ×2); the claim that they
generalize past this pair is **inference from the mechanism**, not measurement.
Re-derive when it next fires.
