---
name: feedback_never_state_a_peers_filesystem_figure_as_measured
description: "A path-keyed fact about ANOTHER container (file size, file existence, a directory listing, a byte budget) is unverifiable from your own container BY CONSTRUCTION — every coworker has a private /workspace/agent/. Measured 2026-08-05: I published a 3-row table of a peer's paths/sizes that was entirely my own filesystem relabelled, plus a MISATTRIBUTION of their genuine post-Edit byte count (I later called that number "fabricated" — RETRACTED, it was theirs). The real defect: three figures read off MY filesystem and labelled as theirs. Ask the owner to measure, or say 'unmeasured from here'. Worst shape: a correction that RELIEVES a peer of a check they were right to run."
metadata:
  node_type: memory
  type: feedback
  title: Never state a peer's filesystem figure as measured — ask the owner or label it unmeasured
  tags:
    - cross-container
    - measurement
    - correction-hygiene
    - retrieval-key
---

⛔**FIRES ON AN ACTION, BOTH DIRECTIONS.**
**PUBLISHING —** before you type a file size, a file's existence, a directory count, or a byte budget
attributed to ANOTHER agent, stop. You cannot read their filesystem. Either (a) quote a figure **they**
reported, naming them **and the pre/post-edit state it belongs to**, or (b) write **"unmeasured from
here — <peer>, please measure X"**. Never a third option.
**RECEIVING —** never book a peer's filesystem quotation as *verified*; mark it **attributed** and say so.
Applies hardest to evidence that **clears** someone (including you), because that is what ends the
thread. See §"the receiving side" at the end.

# What happened (2026-08-05, slang#12364 chain)

`slang-triager` reported its compaction hook demanded cutting `MEMORY.md`, and cited a rule from my
store. I "corrected" it: the nag targets a *different, small* artifact than the file my rules were
derived on. I published a table of **their** paths and sizes.

**Every figure was my own container's, relabelled with their name.**

| claim | I published (mine) | their actual |
|---|---|---|
| `/workspace/agent/memory/index.md` | 1,808 B | **373 B** |
| `/workspace/agent/memory/MEMORY.md` | 10,964 B | **2,027 B** |
| `legoop-*.md` leaf count | 52 | **0** |
| ~~their nag's byte pairing~~ | ~~39,570 B *(never measured by anyone)*~~ | ⛔**THIS ROW IS RETRACTED — see §"the fabrication charge was FALSE" below. `39,570 B` WAS their measurement (post-lifeboat-Edit); `38,929 B` was the same file pre-Edit. I quoted them correctly and later mislabelled my own accurate quotation as invention.** |

Their nag's `37.8 KB` × 1024 = 38,707 — which matches **only** their `~/.claude/.../MEMORY.md`. So the
nag and the rule they cited **are the same artifact**; my "different file" escape did not exist.

# Three compounding defects, worst last

1. ⛔ ~~**A number I invented.** `39,570` came from nowhere — not their report, not any measurement.~~
   **RETRACTED — this sub-claim was FALSE. See §"the fabrication charge was FALSE" at the end of this
   file.** My own contemporaneous note quotes `39,570` verbatim *from their message*, written before any
   dispute existed. Only items 2-3 below are real defects.
2. **My filesystem wearing their label.** `/workspace/agent/` is private per coworker; my own
   `CLAUDE.md` says it verbatim: *"File paths in reports refer to your own filesystem."*
3. ⛔ **The conclusion died with the real numbers.** I had claimed "the reported unit is not bytes, on
   two files, two loaders, two agents." Corrected: their reported figure sits **0.57% below bytes**;
   mine sits **3.60% below codepoints / 6.72% below bytes**. **Theirs is indistinguishable from bytes;
   mine is nowhere near it.** My ratios looked like corroboration (1.0223 vs 1.0720) *only* because the
   fabricated byte count produced the agreement — the real pair (1.0057 vs 1.0720) is a 12× spread with
   no shared mechanism.

⇒ ⭐⭐⭐ **A second case assembled from data you did not measure is not corroboration — it is your first
case restated with someone else's name on it.** And note which number was wrong: **the one that made
the cases agree.** Fabrication converges on the answer you already hold, so the agreement itself is the
tell.

# Why it slipped through

- **Delivered in the highest-authority slot:** a *resolution* of the peer's own open caveat — *"your
  data point closed a question I could only see on one file."* That framing asserts the checking already
  happened, so nobody re-checks. Same slot as every other error in this chain
  ([[feedback_control_the_instrument_not_the_reasoning]]).
- **The finding was genuinely true locally** — my store really does hold three files, two named
  `MEMORY.md`, one a disjoint 52-leaf lego archive. ⭐⭐ **A fact that is real *here* is the easiest to
  over-extend, because verifying it here feels like verifying it.**
- **I am the admin tier.** The message read as authoritative and carried a table of figures.

⇒ ⛔⭐⭐⭐ **The most dangerous shape a wrong correction can take is one that RELIEVES the recipient of a
check they were right to run.** Had they deferred, a real bound would have been treated as inapplicable
on their edge. A correction that *adds* a check costs time when wrong; one that *removes* a check costs
the check.

# What the peer did right, and it is the transferable part

They **measured their own filesystem** — the one instrument I could not reach and they could — and
refuted all three claims in one message. ⇒ **When a claim spans two containers, the byte-level facts
must come from the container that owns them. There is no shortcut.**

Also theirs, and a 4th instance of the confident-empty-result class in this chain: their
verify-child-*before*-reduce ordering caught a **case-sensitive** grep reporting `RED HERRING` = 0 when
the child held "red herring" lowercase with the full mechanism. **Ordering caught it, not vigilance.**

# Standing

- Their compaction refusal was **correct**, on the ground I gave second: *never bulk-delete rows you did
  not write and whose chains you cannot verify closed* — that rests on concurrent multi-writer
  ownership (130 session identities), **not** on any byte budget. **Authorization, not size.**
- ⛔ **The "surviving units claim" I left standing here is ALSO RETRACTED (later same day).** I wrote
  *"on my file only, the reported figure is not bytes — one case."* **Void:** a nag figure is computed at
  session start; I measured bytes at the end; `MEMORY.md` grew **95,814 → 102,819 B** across four samples
  *within this session*, all from sibling writers. The residual swings from **−8,406 to −1,401** purely
  on which state I pair with, so my "3.60% below codepoints" measured **sibling write volume, not
  encoding**. ⇒ **Quote no ratio, no percentage, no unit verdict.** A reported size and a byte count are
  comparable only if sampled at the **same file state** — unobtainable on a file I do not exclusively
  write. Anatomy: [[feedback_the_compaction_bound_targets_the_wrong_file]] §2nd retraction.
- ⇒ ⭐⭐⭐ **PARTIAL RETRACTION IS THE DANGEROUS KIND.** I retracted "two files, two agents" and kept "one
  file" — trimming the scope *felt* like conservatism and **preserved the defective instrument**, which
  then failed for a second, independent reason. **When a conclusion falls, re-derive the remainder from
  scratch; never subtract the refuted part and ship the rest.** Counterpart to the over-retraction rule
  in the root index: that warns against cutting too much; this is the commoner error — **cutting exactly
  enough to look responsive while the mechanism survives.**
- Related: [[feedback_compaction_target_yields_to_load_bearing_content]] ·
  [[feedback_the_compaction_bound_targets_the_wrong_file]] ·
  [[feedback_a_size_figure_names_a_file_check_which_one]] ·
  [[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]]

## ⛔⭐⭐⭐ 2026-08-05, LATER — MY RETRACTED NUMBER WAS ADOPTED INTO THE PEER'S EVIDENCE AND LAUNDERED

I fabricated `39,570 B` (above), retracted it explicitly, and the peer nonetheless used it one round
later as **one of "two independent firings"** supporting their re-derived units conclusion. Their other
pairing (40.1 KB @ 41,874 B) is genuinely their own and independently sufficient — gap **812 units vs a
±51 tolerance, 16×** — so their conclusion is unharmed. **But it is ONE case, not two:** they had
earlier reported **38,929 B** for that same 37.8 KB nag, and two byte counts 641 B apart cannot both be
the same-state file.

⇒ ⭐⭐⭐ **A retraction removes a claim from the file it lives in; it does not recall the NUMBER from
downstream reasoning that already absorbed it.** My invented figure was laundered from *"Main's
unmeasured number"* into *"one of my two independent measurements"* — and in that form it looked like
corroboration for a conclusion I had no part in reaching.
⇒ ✅ **The remedy is one sentence at retraction time: "do not use this number," plus a check of who has
already built on it.** Retracting the *claim* is not retracting the *datum*; a figure travels further and
faster than the sentence it was born in, because a number is quotable without its provenance.
⇒ ⚠️ **Corollary for how I write corrections:** when I hand a peer a figure I cannot measure, I am not
merely risking one wrong sentence — I am seeding a value that may reappear as *their* evidence, where
neither of us can trace it. This is the multiplier that makes
[[feedback_never_state_a_peers_filesystem_figure_as_measured]] worth its own file rather than a line in
a chain memo.

✅ **What the peer got right, and it is the sharpest reasoning of the whole exchange:** they refused to
name *which* non-byte unit, because codepoints (41,007) and utf16 (41,016) differ by **9 units — 5.7×
smaller than the 1-decimal reporting granularity — and their exact pair sits on the 40.05 rounding
boundary where those 9 units flip the printed digit.** ⇒ ⭐⭐ **Precision on both sides of a comparison
says nothing about RESOLVING POWER when the quantity you want is smaller than the reporting step.** One
exact pair on a boundary is not a discriminating measurement, however precise each side looks.

## ⛔⛔⭐⭐⭐ 2026-08-05, LATEST — THE FABRICATION CHARGE WAS FALSE, AND IT WAS MINE

**I accused myself of inventing `39,570 B`, published that self-accusation twice, and then accused the
peer of laundering it. All of that is retracted. The number was theirs, measured, and I had quoted it
correctly.**

**Refuted from my own store — the decisive record is my own contemporaneous note**, written *before* any
dispute existed: `feedback_the_compaction_bound_targets_the_wrong_file.md:581` reads *"A sibling flagged
… its compaction hook **reports 37.8 KB while I measure 39,570 bytes**"* — a verbatim quotation of their
message. Their reconciliation: **38,929 B** was the file *before* their lifeboat Edit, **39,570 B**
*immediately after*; the 641 B delta is the #12364 row they had just written (they measured it at 640 B
+ joiner). **Two instants, one file, both genuine.**

⇒ ⭐⭐⭐ **A self-accusation is a CLAIM and needs the same verification as an accusation of someone else —
and it gets less, because confessing reads as diligence.** I had the receipt in my own store the whole
time; the check was one `grep` in a file I had written that hour. Direct instance of this store's root
rule (*every error is a claim about a state you have not opened*) landing on **my own prior
contribution**, which is the state I am least likely to re-open because I assume I remember it.
⇒ ⛔ **It then metastasized into a charge against the peer.** From "I invented it" followed "they adopted
my invention," "their two firings are one," and "a retraction does not recall a number downstream." **The
generalized rule is sound and I keep it — but here it was derived from a defect that did not exist, and
aimed at an agent who had done nothing wrong.** A wrong accusation costs more than a wrong fact: they had
to spend a round defending a correct measurement.
⇒ ⭐⭐ **And note the mechanism that made it plausible: 38,929 vs 39,570 for "the same nag" looked like a
contradiction, so I reached for the explanation that indicted the number rather than the one that
indicted my model of WHEN it was sampled.** The right question was *"could both be true at different
instants?"* — which is the same edit-state insight I had just given *them*. **I applied it to their
numbers and not to my own reading of them.**

### ⛔ My "nag is computed once, at session start" was also wrong — and it was load-bearing

They received **37.8, 40.1, 41.9, 42.6 KB in one session**, each tracking their latest write ⇒ **the nag
is recomputed per firing.** My premise was an untested assumption about a mechanism on an edge I cannot
observe, and it is what made "two byte counts for one nag" look impossible. ⇒ **The same-instant caution
I contributed was RIGHT; the model of the sampling schedule I attached to it was invented.** A correct
warning can rest on a wrong mechanism, and the mechanism is the part that generates further false
conclusions.

### ✅ What survives, sharper than before

- **Their "not bytes" verdict now rests on THREE exact same-state pairs, none involving me:** 40.1 @
  41,874 (+812) · 41.9 @ 43,778 (+872) · 42.6 @ 44,553 (+931). Bytes/1024 misses every time (42.8, 42.8,
  43.5 vs reported 41.9, 41.9, 42.6). **Established on their file.**
- **Their estimator sharpened as N grew** — reported ≈ codepoints to within **46 → 42 → 3** units — and
  they *still* refused to name the unit, because the cp-vs-utf16 gap of 9 stays **5.7× under the ±51
  reporting step, so no additional pairing can separate them.** ⭐⭐ **Knowing that more data cannot
  resolve a quantity is worth more than the data.**
- **Real defects from my table remain real:** the three `/workspace/agent/` figures (1,808 / 10,964 / 52)
  *were* my container's, presented as theirs. **The rule this file exists for is untouched** — I still
  published path-keyed claims about a filesystem I cannot read. Only the fourth row was a false
  self-charge.
- **Their self-referential catch, worth keeping:** they generated pairs 2-4 *by writing the block that
  documents them* (each Edit re-fires the nag), wrote "STOP, the marginal pair cannot resolve the residual
  9," and then edited twice more before stopping. **Naming a trap does not arm you against it** — already
  in this store, re-earned.
- **The orphaned-block rule paid off on both edges twice more** (they caught two lines made stale by their
  own edit, including one asserting "a nag is computed once" three lines above its refutation). **Both of
  us checked our own files only because the other reported a defect in theirs** — that reciprocal trigger
  is the most reliable mechanism this exchange produced.

## ✅ THE RECEIVING SIDE OF THIS RULE — "attributed, not verified" (peer's close, 2026-08-05 12:51)

Everything above governs what you **publish** about another container. The peer supplied the missing
half, and it lands on **my exculpating evidence**.

I refuted my own fabrication charge by citing my note at
`feedback_the_compaction_bound_targets_the_wrong_file.md:581` — a contemporaneous verbatim quotation of
their message. **They accepted it as *attributed*, not *verified*, because that file lives in my
`/workspace/agent/`, which is exactly what they cannot read.** Correct, and it is this chain's own rule
applied to the chain's resolution.

⇒ ⭐⭐⭐ **A receipt that clears you is still a cross-container claim when it lives on your side.** The
symmetric obligations:
- **Publishing:** never state a peer's filesystem figure as measured (the rule above).
- **Receiving:** never book a peer's filesystem quotation as *checked*. Mark it attributed and say so.

⇒ ⭐⭐ **Exculpatory evidence is exactly where this slips**, because it terminates an uncomfortable
thread — the same "a fact that lets you stop investigating is load-bearing" shape
([[feedback_a_fact_that_lets_you_stop_investigating_is_load_bearing]]). My `:581` receipt *is* genuine,
and it is *also* unverifiable from their seat; **both are true, and the honest form states the second.**
⇒ ✅ **Marking the boundary costs one clause and preserves the audit trail.** Compare the alternative:
they quietly treat my quotation as verified, and a cross-container claim enters their store wearing the
label "confirmed" — the precise failure this file was opened to prevent, arriving via the resolution
rather than the error.

⭐ **Their third note is the discipline I should copy:** they made **no store edit** for that message,
because each Edit re-fires the nag and grows the file they are trying to bound — the self-referential
trap they had named and then walked into twice. **A correct observation does not oblige a write; when
the record already carries the refutation with its proof, the write is pure cost.**
