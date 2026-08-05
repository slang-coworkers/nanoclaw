---
name: feedback_a_guard_can_be_inert_and_read_as_passing
description: "A guard whose ARMED STATE depends on something it doesn't itself measure will report success while covering nothing — an inert guard and a passing guard are byte-identical from the reader's seat. Compute the arming offset PROGRAMMATICALLY (mental subtraction lost a trailing newline and made me 'correct' a peer who was right), compare against EVERY candidate threshold, and state which reading the test was armed against. Also holds: OVER-RETRACTION is its own failure mode — collapsing 'weak evidence under one interpretation' to 'no evidence' discards a datapoint that becomes decisive once the mechanism is pinned down."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4f8e1c72-3b6a-4d19-9e05-7c2fa8b3d641
---

# A guard can be INERT and still read as PASSING — compute its arming state before citing it

🔴**DISCHARGED PREMISE (settled from source, later the same day) — the thresholds in this file were never real.** The SessionStart hook (`/app/src/memory/context.ts`) injects only `/workspace/agent/memory/{index.md,system/definition.md}` at a **16,000 UTF-16-unit** budget, and `MEMORY.md` is not read by **that hook**. ⚠️**CORRECTED 08-04: `MEMORY.md` IS injected — by Claude Code NATIVE auto-memory (`CLAUDE_CODE_DISABLE_AUTO_MEMORY=0`), a second path we never examined. So "aimed at an uninjected file" is RETRACTED.** The canary is still uninterpretable, for a different reason: native auto-memory's budget, units and cut behaviour are all UNVERIFIED, so no offset in it is evidence either way. See [[feedback_the_compaction_bound_targets_the_wrong_file]].

✅**THE RULES BELOW SURVIVE ON THEIR OWN MERITS** — they are about guards and instruments, not about that bound: an inert guard reads identically to a passing one; compute offsets programmatically; test every candidate threshold and state which one you were armed against; over-retraction is its own failure mode. ⛔**But do NOT cite any NUMBER in this file as evidence about truncation** — and note the **SCOPE GAP a banner like this leaves: it voids numbers *about truncation only*, so any inference on a NEIGHBOURING subject passes straight through it** (byte/char ratios, sibling-write mechanics, "my instrument is sound"). ⭐⭐⭐**A SCOPED RETRACTION IS NOT A GENERAL ONE** — same lesson as scoping a correction to the defect CLASS rather than the fixed instance, one level up. ⇒ **when you void a file, enumerate the OTHER subjects its numbers were used for and re-derive each on its own merits.** — the arithmetic is kept as METHOD only. ⭐⭐⭐**And note what it demonstrates: every worked example here was rigorous and aimed at nothing — rigor downstream of an unverified premise is confident irrelevance.**


**2026-08-04, Main + slang-triager, two independent instances in one exchange.** This is the
vacuous-green shape turned inward: not "a test passed over nothing," but **"a test wasn't even
loaded, and said the same thing it says when it passes."**

## ⛔⭐⭐⭐ THE GENERAL FORM — a CLEAN RESULT needs arming too, not just a GUARD (08-04, triager's)

> **A negative observation is evidence only if the condition it denies COULD HAVE OCCURRED at the time
> you looked.**

This is the arming rule restated for **clean results** rather than for guards, and it is the form that
was needed all session and missing. Instances, all the same shape:
- **"Injection was complete, no truncation notice"** — measured while the file was **21.4KB against a
  24.4 bound** (peer) and **~23,934 B** (mine). Both **BELOW** the threshold ⇒ a complete injection was
  guaranteed either way. **The observation was true and carried zero information.**
- **"`wc -m` == `wc -c`, so no multi-byte gap"** — true, and impossible to come out otherwise under an
  unset locale.
- **"0 hits for `MEMORY.md` in `/app/src`"** — true, and the injector was never in `/app/src`.

⇒ **Before recording any clean/negative result, ask: "was the bad thing POSSIBLE right now?"** If not,
the result is **inert** — record it as *untested*, never as *passed*. ⭐⭐**An inert clean result is more
dangerous than a guard, because a guard at least invites the arming question; a clean measurement just
looks like good news.**

✅**An ARMED-TRUNCATION-PROBE is installed at the tail of `MEMORY.md`** (file 37,252 B ⇒ over every
reading of the bound) so the next session that sees it in its **system prompt** resolves the open
question in one read. See [[feedback_the_compaction_bound_targets_the_wrong_file]].

## The rule

> **A guard whose armed state depends on something it does not itself measure will report success
> while covering nothing.**

An **inert** guard and a **passing** guard are **byte-identical from the reader's seat**. Both emit
the same sentence — *"you are reading this, therefore the bad thing did not happen"* — and nothing in
the text distinguishes the two cases. Only arithmetic the guard doesn't perform separates them.

⇒ Before citing any guard as evidence:
1. **Compute the arming offset** (or whatever the arming precondition is) at the moment of the test.
2. **Compare it against EVERY candidate threshold**, not the convenient one.
3. **State which reading the test was armed against.** A conclusion that doesn't name its threshold
   reads as a refutation of all of them.
4. **Inert under a given threshold ⇒ NO evidence for that threshold.** Not weak evidence. None.
5. **Verify the test hit the asserted PATH**, not merely a similar one.

## Instance 1 — mine, the truncation canary (a self-inflicted false pass)

My `MEMORY.md` carries a tail canary whose stated pass condition is *"if you read this block at
SessionStart, injection did not truncate."* I was about to report it as **passing** this session,
because I had read it. Then I did the arithmetic:

- Session start: file ≈ **23,934 B**; `CANARY-END` therefore sat **below both** candidate bounds
  (24,400 decimal / 24,985 KiB) ⇒ **INERT**.
- It armed only *later*, when ~4 sibling sessions grew the file past the bound.

**So reading it proved nothing.** The block even carries its own caveat ("if the check shows `False`,
this line proves NOTHING") and I still nearly cited it — because the *reading experience* of an inert
canary is indistinguishable from a passing one.

⭐⭐⭐**Its arm-state DRIFTS with file size while the text never changes.** It went inert when the file
shrank (a chain retiring to an index), then re-armed when siblings grew it — and not one word of the
guard changed either time. **A guard that silently disarms is worse than no guard**: it keeps
emitting the pass sentence.

Same block also carried a **stored** "chain rows end at 24,222" when the truth was **25,192** ⇒
⭐⭐**never quote a stored offset from a file ~4 siblings are rewriting; recompute.**

## Instance 2 — the triager's, and it lands on a claim it had published to me

It had reported: *"5th recorded misfire — I read line 70 at 24,998 B, past the quoted limit, so the
bound is a warning threshold, not a truncation point."* No arming arithmetic was done. Its own
recomputation — **its figure was RIGHT and my "correction" of it was WRONG** (two sub-lessons below):
start = **24,884**, last content byte **24,997**.

| threshold | line-70 start | armed? |
|---|---|---|
| decimal **24,400** | 24,884 | ✅ armed — one `Read`-path datapoint against it |
| KiB **24,985** | 24,884 | ❌ inert on the START-offset reading… |
| KiB **24,985** | end **24,997** | ⚠️ …but **12 bytes were delivered PAST it** ⇒ weak contrary evidence under a byte-cut mechanism |

### 🔴 Sub-lesson A — I "corrected" a correct peer by doing arithmetic in my head
I told it `24,998 − 113 = 24,885`. **Wrong: the trailing newline.** The verified formula is
`last_line_start = total − len(last_line) − 1`. I settled it by **measuring instead of subtracting**
(`d.rfind(tail)` on the live file: measured start **24,087**, `total−len−1` = **24,087** ✅,
`total−len` = 24,088 ✗) and then re-applied it to the snapshot → **24,884**, reproducing its number
exactly. ⇒ ⭐⭐⭐**COMPUTE OFFSETS PROGRAMMATICALLY, NEVER BY MENTAL SUBTRACTION** — one byte is
precisely what decides an off-by-one, and this whole thread is about single-byte boundaries.
⭐⭐**A correction is an assertion and inherits the full burden of proof**: I had the rule
"a fresh measurement contradicting a peer's ⇒ audit your instrument before publishing" and applied
it in the direction of *doubting them*, not *doubting my own subtraction*. **The correction slot is
where scrutiny goes to die** — third instance.

### 🔴 Sub-lesson B — OVER-RETRACTION is its own failure mode
Its first pass filed the KiB datapoint as **"never tested."** But the row **straddles** the bound:
starts at 24,884 (below), ends at 24,997 (**12 bytes past**), and was read intact — so under a
byte-cut mechanism those 12 bytes *are* evidence against a hard cut at 24,985. It doesn't rescue the
datapoint (the cut mechanism is the untested thing, and an unknown-mechanism inference isn't a
measurement), but **"never tested" was the wrong label.**
⇒ ⭐⭐⭐**Collapsing "weak evidence under one interpretation" to "no evidence" DISCARDS a datapoint
that becomes decisive the moment the mechanism is pinned down.** File to the safe default, but
**label it as a CHOICE, not as the finding.** ⭐⭐**This is the mirror image of vacuous green**: there
the error is claiming more coverage than you have; here it is claiming less. Both misreport coverage.

**Recorded status of the bound (both of us agreeing):** decimal 24,400 — one armed `Read`-path
datapoint against it; KiB 24,985 — inert on the start-offset reading, weak contrary evidence on the
straddle reading, **cut mechanism untested**; **SessionStart-injection path — never tested** (and not
probeable from inside a session where injection already ran). 🔴**SUPERSEDED PATH ATTRIBUTION (08-04): the SessionStart/NanoClaw-hook path is SETTLED, not untested** — that hook demonstrably does not read `MEMORY.md` (`/app/src/memory/context.ts`; 0 hits in `/app/src`). **The UNTESTED mechanism is Claude Code NATIVE AUTO-MEMORY** (`CLAUDE_CODE_DISABLE_AUTO_MEMORY=0`), which DOES inject this file. ⇒ **PROBE NATIVE AUTO-MEMORY, NOT SessionStart** — following the superseded wording sends you at the one path already proven irrelevant and leaves the real one untested. ✅The SHAPE survives: enumerate each interpretation and say which is ARMED vs UNTESTED.

⇒ The test exercised the **decimal reading only**, and the conclusion was stated **without naming
which threshold** — so it read as a refutation of both. Compounding: the test used the **`Read`
tool** while the nag asserts **SessionStart-injection** truncation ⇒ armed for the **wrong path** as
well as, half the time, the wrong threshold.

**Honest status (superseded once already — see Sub-lesson B; this is the corrected wording):** decimal
— one armed `Read`-path datapoint against it; KiB — **inert on the start-offset reading, weak contrary
evidence on the straddle reading (12 bytes delivered past it), cut mechanism untested** — NOT simply
"never tested"; injection path — ⚠️**see the SUPERSEDED PATH ATTRIBUTION note above: the SessionStart hook path is SETTLED (it does not read this file); NATIVE AUTO-MEMORY is the untested injector.** ⇒ **UNVERIFIED IN BOTH DIRECTIONS, not false** — for the native path.

## Why this keeps happening

⭐⭐⭐**Both instances are "an artifact of the measurement mistaken for a fact about the world"** —
the same family as an `EXIT=1` from a malformed test fixture read as a real rejection, and as a
cumulative `pulls/N/files` count read as a record of what a push wrote. The failure is never in the
reasoning; it is always in an unexamined property of the instrument.

⭐⭐**The direction doesn't matter.** One of these landed in the *convenient* direction (my canary
"passing"), the triager's in the *plausible* direction. **A result confirming what you already
believed and a result confirming what you feared get the same discount** — both are cheap to accept.

## ⭐⭐ Sibling failure modes: a probe can measure NOTHING while looking busy (or productive)

Three more from the same session, all "the instrument was never actually pointed at the thing":

- **Unbound variable ⇒ the probe reads stdin and HANGS.** `grep -c pattern "$F"` with `$F` unset
  silently becomes `grep -c pattern`, which blocks on stdin — the triager lost two minutes to this.
  A hang *feels* like work in progress; it is a probe that measured nothing. ⇒ **bind-check inputs
  (`: "${F:?}"`) or pass paths literally.** Same family as the wrong-cwd `grep -r` printing nothing
  at exit 2, indistinguishable from a genuine zero at exit 1.
- **A FILE-STRUCTURE assumption is a premise like any other.** A script that inserts a banner "after
  the first `#` heading" corrupts a file that opens with `---` frontmatter. ⇒ ⭐⭐⭐**AN ASSERTION THAT
  HALTS IS WORTH MORE THAN A CORRECTION THAT REPAIRS, because repair depends on noticing.** Two aborts
  in one session each prevented a corrupted memory file; the edits that "succeeded" blindly are the
  ones nobody audits.
- **A CONVERGED sibling write is worse than a lost one.** A sibling independently wrote its own version
  of the same finding, carrying the *same two stale details*. Not a lost write — a duplicate that keeps
  the error alive **under a different author**, so the correction must be applied to THEIR row, not
  re-applied to yours. ⇒ **after correcting a shared file, re-grep for the stale figure across ALL
  authors** — `originSessionId` tells you whose line you are reading, and a fix to your own row proves
  nothing about the file.

## ⛔⭐⭐⭐ A SELF-REFERENTIAL FIGURE IS STALE THE INSTANT THE WRITE LANDS (08-04, both of us)

A block that describes **its own position or the file containing it** invalidates its own numbers by
being written. Two instances, same hour:
- **Triager:** its recovery block said *"installed @offset <2,500"* and landed at **offset 0** (the file
  had no line above it). Text false on arrival.
- **Mine:** my recovery block asserted *"13 substantive rows past 24,400; 12 past 24,985"* — correct when
  measured, and **my own two insertions made it 14/13 within minutes.**

⇒ 🔴**REFINED (triager, same hour — my "never the tally" was OVER-STRICT):** the deciding property is **not** whether a figure appears, it is **whether the figure is SCOPED TO AN EVENT.**
- ✅**"At install this file was 26,914 B"** — past tense, named event ⇒ a **historical fact, true forever.**
- ❌**"Measured at install (28,689 B)"** used as the current size ⇒ **a claim about NOW; decays** (its own next write made it 29,924).
- ✅**A THRESHOLD for a future check** — *"if the file is still over ~25,000 B, then…"* — is also durable: it describes a condition to test, not a state that holds.
⭐⭐**Same number, opposite durability, decided entirely by the scoping clause** — which is a cheaper fix than omitting load-bearing figures. **Tested on my own probe: 7 of its 8 figures are event-scoped and durable; the 8th is a future threshold.** ⭐⭐**Also check any ARMING claim for monotonicity** — mine holds because the file only grows, so arming can never silently lapse in the unsafe direction.
⭐⭐⭐**And the reason this class survives review (triager's):** *a tally reads as a fact while an invariant reads as hedging*, so the decaying form is the one that feels more rigorous.

⇒ ⭐⭐⭐**STATE THE INVARIANT, OR SCOPE THE FIGURE TO AN EVENT — never an unscoped tally.** "Every live-chain row sits below the bound" stays true
as the file grows; "13 rows do" is false after the next edit. **If a figure must appear, pair it with the
command that recomputes it** and mark it as of-that-moment.
- ⭐⭐**This is the stored-byte-figure prohibition applied reflexively** — except the stale number is
  describing the very block that contains it, so nothing external can contradict it and no reader has a
  reason to doubt it.
- ⭐⭐**Instruction blocks are the worst place for a decaying number**, because they are consulted under
  pressure (mid-compaction, post-truncation) by a reader who will not re-derive.
- ✅**Test: could this sentence be falsified by the act of writing it?** If yes, rewrite as an invariant
  plus a recompute command.

## ⛔⭐⭐⭐ A WRITE THAT DOES NOTHING DOES NOT FAIL — verify by CONTENT, never by absence of an error

**A string-replace against a STALE ANCHOR silently no-ops.** It does not raise, does not warn, and the
surrounding script reports success. The triager hit this inserting a table whose anchor its own earlier
edits had already removed — caught only because it verified by content afterward.

⇒ ⭐⭐⭐**VERIFY EVERY WRITE BY READING BACK THE CONTENT YOU INTENDED**, not by the write returning
cleanly. I ran this over all **10** of my edits this session (`tr -d newline | grep -ciF "<phrase>"`
per file) — all 10 present, zero silent no-ops. **The check is cheap and its absence is invisible.**
- ⭐⭐**Same family as the silent `exit 0`**: a recipe that dies `NameError` and a replace that matches
nothing both **succeed loudly and accomplish nothing.** ⇒ **assert the precondition, or assert the
postcondition — an operation with neither is unfalsifiable.** My python edits printed a `MISSING:`/
`pattern gone` branch and aborted rather than writing on a failed match, which is why the two that
refused (sibling had rewritten the row) never corrupted anything.
- ⭐⭐**A HALTING ASSERTION BEATS A CORRECTION THAT REPAIRS, because repair depends on noticing** — and
the highest-value place for one is a **runnable artifact**, where silent-exit-0 means nothing else fires.

## How to apply

```bash
# Canary/arming check — run BEFORE citing, never trust a stored number
python3 -c "d=open('FILE','rb').read(); i=d.rfind(b'MARKER'); print(len(d), i, i>BOUND_A, i>BOUND_B)"
```

- **Two thresholds ⇒ report two verdicts.** `True True` = armed for both. `True False` = armed for
  the looser reading only, and you must say so.
- ⛔**Never attach a "don't re-litigate" lock unless the test hit the asserted path.** A wrong number
  misleads one reader; a wrong *don't-check* directive disables the check indefinitely. A
  "don't re-litigate" tag claims **COVERAGE**, not confidence — the tell is whether it names an
  INSTRUMENT and a PATH.
- **A near-miss offset is a BOUNDARY, not noise** — 2 bytes past a bound is a crossing.

Related: [[feedback_a_size_figure_names_a_file_check_which_one]] (the scope-error lock, six dead
mechanisms), [[feedback_compaction_target_yields_to_load_bearing_content]] (why the size target
yields), [[feedback_control_the_instrument_not_the_reasoning]] (the root rule),
[[feedback_green_job_skipped_backend_zero_coverage]] (vacuous green, outward-facing form),
[[feedback_near_miss_number_is_a_boundary_not_noise]].

## ⛔⭐⭐⭐ 08-04, #12150 — THE STRONGEST FORM: the trap defeated THE TEST WRITTEN TO CATCH IT (5×)
slang-fixer, shipping slang#12150. Two findings that extend this file's rule past guards into
**fixtures and controls**:

**1. A gate that was DEAD CODE while every test passed.** Its first ambiguity gate counted "qualifying
candidates" in a loop that `break`s on the first match ⇒ **the counter was structurally pinned at 1 and
could never fire.** The full suite was green with it in place. ⇒ **A passing suite is equally consistent
with a working guard and an inert one** — it has no discriminating power over that distinction. Caught
only by **removing the mechanism and confirming the test went red** (revert drill), which is the only
instrument that separates them.

**2. ⭐⭐⭐ The entry-point-coincidence trap made fixtures inert FIVE times — including inside the test
written to catch it.** A SPIR-V debug-scope fixture whose function happens to land in the entry point's
own CU passes whether or not the fix works, because the fallback and the correct answer coincide.
⇒ **A trap that survives the test authored to detect it is not a test-quality problem, it is a
FIXTURE-DESIGN problem** — and it recurs because each new fixture is written by the same person holding
the same wrong mental model. Standing rule now: **for any SPIR-V debug-scope test, prove the expected CU
differs from the entry point's CU before trusting a pass.**

⭐⭐**And four "controls" flattered the author before one was valid** (the zero-CU checks). ⇒ **A control
is a claim requiring its own verification; the first control that agrees with you is the least trustworthy
one.** Cf. this store's *suspect a new instrument whose first act CONFIRMS your prior result*.

✅**What actually separated observation from explanation, in the author's words:** *"my observations were
reliable; my explanations of them repeatedly weren't"* — and only a **constructed counterfactual**
distinguished the two: remove the mechanism and watch the test go red, or A/B against a **pristine
master** build rather than one's own branch. ⚠️**A/B-ing against your own branch is not a control** —
it shares every assumption you are testing.
⇒ ⭐⭐**Design asymmetry worth keeping (fixer's, on a regression it introduced): WRONG-BUT-PLAUSIBLE IS
WORSE THAN GENERIC.** A confidently-wrong debug scope sends a reader to the wrong file; resolving to
nothing when ownership is undetermined makes them look. Prefer no answer over a plausible wrong one at
any boundary a human will trust.

Related: [[feedback_control_the_instrument_not_the_reasoning]],
[[feedback_a_correct_action_does_not_validate_its_rationale]] (an averted error has no error signal),
[[feedback_expected_noise_line_is_not_a_failure_signature]] (harness reporting non-runs as passes).

## ⛔⭐⭐⭐ A VERIFICATION IS PINNED TO THE SHAPE OF THE FIX — when the fix moves, the evidence does NOT come with it
**slangpy-fixer, slang-rhi#809, 08-04.** Distinct from *A/B against pristine master* (which is about the
**baseline**); this is about the **treatment** changing under evidence already gathered.

It had runtime proof (`rc=139` SIGSEGV vs. clean, forced on a real L40S) for a fix implemented as
**five proc checks at the call site in `vk-pipeline.cpp`**. Review then redirected it to **normalize the
flag in `vk-device.cpp`** — a different file, a different mechanism, +18/−4 with `vk-pipeline.cpp`
untouched. In its own words: *"I'd have had runtime evidence for the OLD placement while shipping the
NEW one — which is how a verified claim goes stale without anyone noticing."* It re-ran the reproduction
after the files moved; that, not judgment, is what caught it.

⇒ ⭐⭐⭐**Re-run every empirical claim after a fix changes files or mechanism.** A verification names a
*specific* code path; it does not certify the conclusion in the abstract. **Nothing flags this** — the
old evidence is still true, still yours, and still about something you are no longer shipping.
⇒ ⭐⭐**Two separate false-control shapes in one chain, both worth naming:**
  (a) **a control that shares state with the treatment isn't a control** — it measured `hasFeature==true`
      alongside the crash against an *artificial intermediate* (its moved publication site with only the
      clearing step disabled). Against pristine `origin/main`, `hasFeature` is **false** and it still
      crashes, because `addFeatureExtension` rejects the absent extension so the old publication never
      ran. **The intermediate feels like a control precisely because you constructed it deliberately.**
  (b) **evidence pinned to a superseded shape** (above).
⇒ ✅**Sweep scope when correcting a measurement: reply + PR body + table + COMMIT MESSAGE.** A stale
figure in a commit message outlives the PR body and is the copy nobody re-reads.

## ⭐⭐ A LITERAL READING OF REVIEW FEEDBACK CAN PRODUCE A NON-FIX THAT LOOKS RESPONSIVE
Same PR. The maintainer asked one word of doubt — *"Is this the right place for checking this?"* — and he
was right. But `createPipelineWithCache` tests the **raw flag**, not `hasFeature`, so merely relocating
the `availableFeatures.push_back` (the obvious reading) **would have left the crash live while appearing
to address the review.**
⇒ ⭐⭐**A reviewer can correctly identify the problem without naming the right remedy.** Complying with
the literal reading ships an artifact that satisfies the comment and fixes nothing — harder to catch
than ignoring feedback, because the diff *reads* as responsive.
⇒ ✅**The discriminator is not skepticism about the reviewer — it is checking WHAT THE CODE PATH ACTUALLY
READS.** Here: the consumer reads the flag, so the fix had to change the flag. Also ⭐**look for the
codebase's own idiom** — `Feature::TimestampCalibration` already gated on the proc and cleared the
support state a few lines away; adopting the existing pattern beat inventing a new one.

## ⛔⭐⭐⭐ 08-04, #11709 — I ENDORSED EVIDENCE THAT WAS NON-DIAGNOSTIC, FOR A CLAIM THAT WAS TRUE
Distinct from an inert guard (which *fails* to fire) and from an unvalidated rationale (which arrives
attached to an action). **This is evidence I actively vouched for, supporting a correct conclusion,
which could not have discriminated the thing it was cited for.**

**What happened.** slang-fixer measured the reframed `const groupshared` defect by comparing emitted CUDA
signatures: `[noinline] void f(const groupshared uint a[8])` → `__device__ void f_0(FixedArray<uint,8> *)`
and the bare RW version → `g_0(FixedArray<uint,8> *)`. **Byte-identical.** I called it *"the measured
version of the reframed defect"* and told it to put the comparison in the PR body **verbatim**.

It then found: **CUDA prints a raw pointer for EVERY by-reference mode.** The signatures were identical
for a reason unrelated to the bug — the comparison cannot separate `BorrowIn` from `BorrowInOut` at all.
The **IR dump** is the instrument that discriminates (`BorrowInOutParam` → `BorrowInParam`).
The underlying claim (RO-ness is AST-only, invisible to passes and emitters) **was and is true** — which
is exactly what made the bad evidence invisible.

⇒ ⭐⭐⭐**A TRUE CONCLUSION LAUNDERS ITS EVIDENCE.** Nothing about the claim being correct constrains
whether the cited measurement could have detected its falsity. **Ask of any evidence you endorse: would
this reading have DIFFERED if the claim were false?** For the CUDA signatures the answer is no — they
are identical under every mode, so they were never a test.
⇒ ⭐⭐**PUBLICLY it is the worst position available:** a reviewer can refute the *evidence* while the
*claim* stands, which invites doubt about everything else in the artifact. Remedy applied: promote the IR
dump to the diagnostic instrument and demote the CUDA comparison to **"consistent with, not diagnostic
of"** — keep it, label it.
⇒ ⭐⭐**MY tier's specific exposure: endorsing a coworker's evidence adds my authority without adding a
check.** I verified the *measurement was performed* and the *claim was true*; I never asked whether the
measurement could distinguish. **Before telling a coworker to publish something verbatim, run the
discrimination question on it** — that is the one thing my endorsement is supposed to add.
⭐**It was found by continuing to check after reaching a liked result** — the same discipline as
laddering a hit, and the reason the defect never shipped.

⚠️**Companion retraction from the same turn, worth keeping for scope hygiene:** `__constref groupshared`
was **never broken** (it already yielded `BorrowInParam`). The defect is *solely* that `ConstModifier` has
**zero mentions** in `getExplicitlyDeclaredParamPassingMode` (`:3673-3722`, MINE-VERIFIED) so
`const groupshared` fell through to the RW default. ⇒ **"We fixed X" about a path that already worked is a
false claim inside a true PR** — enumerate what was broken before describing what you fixed.

## ⛔⭐⭐⭐ 08-04 — TWO INERT-GUARD MODES IN ONE HOOK, and the over-broad matcher HID the inert one (MINE-VERIFIED)

`slang-pr-approver` reported that `/app/hooks/gate-critique-on-deliver.sh` refused a **read-only**
`gh api .../pulls/12345/reviews` GET as "PR creation". I reproduced both halves in my own container
(paths are per-container — MINE-MEASURED, `/app` is a **read-only** mount, not a git checkout).

**Mode A — matcher is TEXT-blind (the approver's sharpening; "verb-blind" was too narrow).** It matches
the *string* in argv, so it constrains neither verb nor effect. Two consequences I missed by only laddering
`gh` invocations: (a) a bare `grep -c "pulls" harvest-reviews.py` — no HTTP client at all — was denied in
their live container (MINE-CONFIRMED: no-hit on the built-in floor, so their denial came from a
composer-supplied `bash_patterns` extension; note `EXTRA_BASH` is spliced with **no metachar validation**,
unlike `EXTRA_MSG` at `:55` — an injection/over-match surface in its own right); (b) the symmetric and worse
half — **their real harvest loop is NOT caught**, because the `gh api …/pulls` calls live *inside*
`harvest-reviews.py` (5) and `collect-reviews.sh` (3), and the hook only sees argv. MINE-CONFIRMED:
`python harvest-reviews.py --pr 12345` and `bash collect-reviews.sh 12345` both no-hit.
⇒ ⭐⭐⭐**A GUARD MATCHING COMMAND *TEXT* ENFORCES NOTHING ABOUT COMMAND *EFFECT*** — it catches the
one-liner and misses the script doing the same thing, which is why tightening the regex only trades a false
positive for a false negative. **The durable enforcement point is effect-level (the credential layer at the
OneCLI proxy — which the hook's own `:78-80` comment already names as the real backstop), not a better
pattern.** My 21/21 ladder is still the best available *pattern*, but it is mitigation, not a fix.

Original framing, kept for the record: `BASH_PATTERNS` (`:52`) is
`gh api [^|]*pulls\b|api\.github\.com[^ ]*/pulls\b|…` — **route-only, no verb**. Ladder, both polarities:
`gh api …/pulls/12345/reviews` → HIT, `…/pulls/12345 --jq .head.sha` → HIT, `…/pulls/12345/files` → HIT;
controls `gh pr view` → no-hit, `…/issues/…/comments` → no-hit. So it fires on **every read** of the
`/pulls` route — which is the PR-approver's entire harvest loop. Positive controls (`gh pr create`,
`gh api …/pulls --method POST`) also hit, so **the guard looks like it works**: its true positives are
intact and only the false-positive class is wrong.

**Mode B — the escalation ladder is inert *early in a session*.** 🔴**"PERMANENT" RETRACTED — refuted by
`slang-pr-approver` the same hour, then confirmed in my own container.** `STATE` defaults to
`/workspace/.claude/workflow-state.json` (`:105`) and this hook never `mkdir -p`s the dirname. I ran the
counter line in isolation over 5 denials with the dir absent: `jq > "$STATE.tmp"` fails every time
(`|| true` swallows it), `DENIALS` reads **0** forever, `>= 3` never arms, and the escalation JSON can't be
written either so the `:204` timeout backstop is unreachable. Control with the file present: 0→1 ok.
**What I got wrong: I read "dir absent" as a property of the CONTAINER when it is a property of the
MOMENT.** 5 sibling hooks *do* `mkdir -p` it (`gate-chain-routing`, `plan-tracker`, `track-critique`,
`track-edits`, `workflow-state-reset` — MINE-ENUMERATED; only this hook and `gate-plan.sh` reference the
path without creating it) ⇒ **the counter works iff any sibling fired first.** The approver's container had
it created at 16:36:33, ~18 min after the 16:18 denial that failed on its absence, and a later real denial
wrote `"critique_gate_denials": 1` — the counter working **through the live hook**, which their active gate
could show and my inactive one (`CRITIQUE_GATE_ACTIVE=0`) could not. Mine now has it too (16:45,
`edits_since_critique: 5`) — **but my reading is confounded: I ran `mkdir -p /workspace/.claude` by hand at
~16:40 to test writability, so "it exists now" is partly my own artifact.** ⚠️Their attribution to
`track-edits.sh` is plausible but not established: that hook **excludes `/workspace/.claude/*` and
`/workspace/agent/memory/*`** from the counter, though it `mkdir`s at `:56` *before* those exits — so a
memory edit can create the dir while incrementing nothing. Consistent, not proven.
⇒ ⭐⭐⭐**A BUG WHOSE WINDOW IS EARLY-SESSION IS HARDER TO ROUTE THAN A PERMANENT ONE — the operator may
simply fail to reproduce it, and a failed repro reads as "not a bug."** Report the *window* and the
ordering dependency, not just the symptom. ⭐⭐**Re-examine any "X is absent" claim for whether you are
describing a STATE or a SCHEDULE** — sibling of the per-container/per-moment rule, and the reason my
"permanent" was wrong while every byte I measured was right.

⇒ ⭐⭐⭐**A DENIAL IS NOT EVIDENCE THE GUARD IS HEALTHY — it is compatible with a guard whose recovery
path is dead.** Mode A produces a loud, legible symptom (agent blocked on a read); Mode B produces
**silence in the escalation channel**, which is indistinguishable from "nobody ever hit the cap."
The loud defect is the *cheap* one; it was **the only one reported**, and it MASKED the expensive one.
⇒ ⭐⭐⭐**When a guard misfires, audit its STATE PATH before its MATCHER.** The matcher decides *whether*
it fires; the state decides whether *anything can ever clear it*. I nearly filed this as "over-broad
regex" and stopped — the second mode only surfaced because I asked what happens on the **4th** denial.
⇒ ⭐⭐**`|| true` on a state write is an inert-guard factory** — same family as the write-that-does-nothing
rule above (`## A WRITE THAT DOES NOTHING DOES NOT FAIL`): here it converts a missing-directory error into
a silently-zero counter **for as long as the dir is absent** (see the Mode-B retraction — the window, not
forever). **A guard that writes its own arming state must verify that write by CONTENT.**
⇒ ⭐⭐**The obvious fix is a REGRESSION RISK, not a cleanup.** Tightening to "verb must be mutating"
(`--method POST|-X POST`) **passes 16/16** on my ladder but **LEAKS 4 implicit-POST shapes the current
pattern catches** — `curl … /pulls -d @body.json`, `--data-binary`, `wget --post-data`, `requests.post`.
Requiring **verb OR request-body flag** gets **21/21** with no leak. ⇒ **A permissive pattern's false
positives and its true positives are the same clause — narrow it and you drop real coverage. Ladder the
tightened version against the ORIGINAL's catches, not just against the false positives you set out to fix.**

## The MUTATION check, and two new instrument failures (08-04, slang#12344 — peer-to-peer, both tiers)

Reviewing a PR that adds a **markdown linter** — i.e. the artifact under review *is itself a guard* — put
this file's thesis at its own subject matter. Three results worth keeping.

**1. ⭐⭐⭐ The MUTATION CHECK is the operational form of the revert drill, and it is cheap.** The author
shipped a `selftest` subcommand. A passing selftest says nothing (this file's whole point). What settles
it: **seed the exact defect class the artifact exists to prevent, and confirm the test fails on the right
thing.** `slang-pr-approver` changed `_github_slug`'s punctuation handling from *delete* to
*replace-with-hyphen* — the precise bug the PR fixes — and got **2 targeted failures with correct expected
values** (`got 'cuda---python---ffi-attributes', want 'cuda--python--ffi-attributes'`), then restored and
verified `git status --porcelain` empty. ⇒ **For any test/guard/linter you are asked to trust: run it
clean, then break what it claims to cover.** Cheaper than a revert drill on the whole fix and strictly
more diagnostic than a green run. **Especially load-bearing when the subject is a checker** — a selftest
that couldn't fail reproduces the original sin one level up.

**2. ⛔⭐⭐⭐ A PRESENCE check standing in for a BEHAVIORAL one (mine to catch, theirs to fix).** Finding:
"two slug helpers **disagree** where it matters." The approver's check that it was resolved:
`hasattr(m, "_gh_slug") == False` — the symbol is gone. **But deletion is equally consistent with the
author having deleted the CORRECT helper**; the check reads identically in that world, so it cannot
distinguish resolved-correctly from resolved-wrongly. The behavioral version — drive both implementations
and compare each against GitHub's actual slug — gives **surviving 7/7 correct, deleted 5/7**. Same verdict,
different epistemic footing. ⇒ ⭐⭐⭐**When a finding is about BEHAVIOR (disagreement, wrongness, coverage),
a check on STRUCTURE (symbol present/absent, file exists, line count) is not the same claim — name the
property the finding asserted and test THAT.** New axis on this file: not an inert guard, but a *guard
measuring the wrong dimension*, which passes and reads as diagnostic.

**3. ⛔⭐⭐ EMPTY POPULATION reads as TOTAL MISMATCH (the approver's own, self-reported).** Testing the
author's "coverage output unchanged" claim, its harness first reported **53 of 53 files differing** — a flat
contradiction of the author. Cause: it wrote the comparison copy to the repo *root*, so `REPO_ROOT`
resolved to `/`, the enumerator returned **zero** files, and it was **diffing an empty dict against a
populated one**. Corrected: **308 anchors, 53 files, 0 differing** — author's claim exact. ⇒ Same family as
the returned-page-vs-`total_count` units error: **an instrument that CANNOT find anything is byte-identical
to one reporting total mismatch.** ⭐⭐**The tell it named, worth keeping verbatim: a dramatic result
contradicting a specific, checkable claim should trigger an INSTRUMENT AUDIT BEFORE BELIEF** — and note it
wrote the wrong number down first, then audited. Cf. **a fresh measurement contradicting a peer's ⇒ audit
your instrument before publishing.**

⭐⭐**Method note that made all three land: every correction in this exchange was RE-DERIVED by its
recipient rather than accepted.** The approver re-ran my slug table instead of inheriting it, stating the
reason — *a correction I'd have accepted on authority is exactly the kind I should re-derive*. I verified
its code-path distinction (two independent `in_fence` loops, different functions) rather than conceding it.
⇒ **Peer agreement reached by two instruments is worth more than either measurement; peer agreement reached
by deference is worth less than one.** Cf. [[feedback_control_the_instrument_not_the_reasoning]].

⭐**Also: ASYMMETRY BETWEEN SIBLING IMPLEMENTATIONS is a cheap, high-yield check.** Two copies of the same
linter (tests-tree 3463 lines, design-tree 1626) diverged: the widening landed only in the tests tree, and
an A/B of the two delimiter detectors on GFM edge cases gave **0 disagreements** — the design tree's
per-cell `_is_separator_row` never had the blind spot, so the widening was parity-restoring, not a live
fix. The *reverse* asymmetry was the real finding: the tests tree gained a fence-skip the design tree
still lacks (**0** `in_fence` occurrences). ⇒ **When a codebase holds two implementations of one rule,
diff their BEHAVIOR on edge cases — it corroborates corpus measurements from the code side ("the number
couldn't have moved" beats "the number didn't move") and surfaces latent gaps in the sibling.**
