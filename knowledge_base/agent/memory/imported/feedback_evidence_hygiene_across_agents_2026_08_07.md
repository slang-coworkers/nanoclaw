---
name: feedback_evidence_hygiene_across_agents_2026_08_07
description: "2026-08-07 spill #2 — cross-agent evidence hygiene: probe-beats-verdict (one reviewer, both modes); the unaudited reading is the one that COSTS NOTHING to leave standing (incl. against your own interest); 'no longer applies' == 'cannot be reached'; a debug line table is content-addressed provenance; a rule that must be RECALLED will be bypassed, only a changed DEFAULT holds; reading a PREFIX of a file and reporting it as the file."
metadata:
  node_type: memory
  type: feedback
---

# Cross-agent evidence hygiene — 2026-08-07

⛔ **Second spill from [[feedback_optimized_lane_can_be_inert_for_the_fix]] → [[feedback_an_assertion_that_cannot_fail_2026_08_07]], which crossed 24,986 B on the same night I split it — I recreated the bug I had just fixed.** Sibling holds the test-instrument entries (`diag=` matcher, drill blind spot, prose-has-no-instrument, freshly-fixed-regex zero, delegated-probe control loss). This file holds the *cross-agent* entries.

### ⭐⭐⭐ ONE REVIEWER, TWO MODES, ONE NIGHT: handing over a PROBE beats handing over a VERDICT

**Measured contrast from `slang-reviewer` on two sibling chains, 2026-08-07 — same reviewer, opposite value:**

| mode | instance | outcome |
|---|---|---|
| **asserted an unmeasured conclusion** | #12419 `[CudaHost]` — *"four probes produced zero bytes of `__host__`"* ⇒ told the fixer **not** to add a `__host__` check, concluding `-target torch` routes via `CPPSourceEmitter` | ⛔**REFUTED.** Fixer measured `__host__ int hostHelper(int x_0)` on plain `-target cuda` **with a positive control** (drop `[CudaHost]` → `__device__ __noinline__`). Reviewer later **retracted**: its probe binary was **49 commits stale** and failed that control |
| **flagged its own inference as unmeasured and handed over the PROBE** | #12417 signed zero — declined to assert, supplied the experiment | ✅**Produced a materially better position:** `[Differentiable]` `dot` already returns **−0.0** on unpatched master (`-cpu` *and* `-vk`) while plain `dot` alongside returns **+0.0** ⇒ the PR **removes a pre-existing inconsistency** rather than introducing a deviation |

⇒ ⭐⭐⭐**A reviewer's verdict inherits its author's instrument; a reviewer's probe inherits the recipient's.**
So handing over an experiment transfers the finding to whoever has the *current* tree, which is exactly the
party whose binary isn't 49 commits stale. **Brief reviewers to supply probes for anything they haven't
measured, and treat "I probed it, N times" as unverified until the probe's own control is named.**
⚠️**A negative with no control cannot outrank a positive with one** — four uncontrolled probes lost to one
controlled measurement, and the count made it *look* stronger (cf. the raw-count-reads-as-corroboration trap in
[[feedback_a_pending_tell_does_not_catch_the_error_it_was_designed_for]]).
⭐**Its own generalization indicts its own finding, correctly:** *"five reviewers agreeing correlated because
they shared a method (reading), not an observation"* — confidence 95 from "5 sources converged" is **one
observation counted five times.**
⭐**And the good mode did not change the GATE, only the FRAMING:** which of ±0.0 is *correct* is still a
maintainer's semantic call, so the item stayed open. **A better-evidenced position is not a resolved one** —
the fixer kept it "open by design," which is the right read.

### ⛔⭐⭐⭐ REFINEMENT to "the expected reading goes unaudited": it is the reading that COSTS YOU NOTHING TO LEAVE STANDING — including one against your own interest

**Three measured instances, 2026-08-07, three different actors, all in one night — and none of them flatters
its author:**
| instance | direction | why nobody audited it |
|---|---|---|
| `slang-fixer`'s stale `cpu-program` **9/10** (real value 10/10 — `gfx-smoke` had cleared on the new base) | made **its own work look worse** | a figure that understates your result invites no challenge; it would have survived indefinitely behind a hedge |
| `slang-ci-babysitter`'s three instrument defects (`filter=all` carry-over 8.4% vs 10.6%; dead assert probe; invented run id) | all biased toward **NOT escalating** | an error that suppresses action produces **no incident to investigate** |
| **mine** — *"correlation, not causation"* on the draft/CI question, left standing ~20 min after I had verified the mechanism at `ci.yml:15`/`:681`/`:53` | **understated my own case** to the operator | a hedge **reads as caution**, so it is the last sentence anyone re-examines |

⇒ ⭐⭐⭐**The unaudited class is NOT "self-serving" and NOT merely "expected" — it is any reading whose
direction costs nothing to leave standing.** A self-serving error invites challenge from others; a
**self-diminishing** one invites challenge from *nobody*, because no other party is harmed by it. That makes
the against-your-interest error the **more durable** of the two.
⇒ ⭐⭐**A stale hedge is a defect, not humility.** *"Correlation, not causation"* was true when written and
false twenty minutes later; leaving it made a decision-maker weigh a weaker case than the evidence supported.
**When you strengthen a finding, sweep for your own earlier qualifiers** — same enumerate-don't-recall rule as
[[feedback_correction_unapplied_until_every_restatement_fixed]], applied to hedges rather than figures.
⇒ ✅**Operational test, cheap and pre-claim:** after any correction, ask *"who is harmed if this stays wrong?"*
**If the answer is "only me" or "nobody," it will not be caught — so audit it now.**

⭐**Peer's framing, kept because it is checkable BEFORE the claim rather than recognizable after:** *"a status
is meaningless without naming the system it lives in — 'approved' needs 'approved in what'."* Four instances
tonight of one shape — peers' verdicts substituted for GitHub review state · a local body for the published
one · a working tree for `git show HEAD:` · **my merged inbox for a peer session's own transcript.** ⇒ **Name
the system with the status, every time.** That rule catches all four; the post-mortem version
("I substituted the artifact I could see") catches none in advance.


### ⭐⭐⭐ "NO LONGER APPLIES" AND "CANNOT BE REACHED" ARE THE SAME CLAIM — a state assertion the artifact refutes on opening

**Measured n=2 with the roles REVERSED, one night, one PR pair (#12419):**
| claimant | claim | refuted by |
|---|---|---|
| **reviewer** | *"`[CudaHost]` is unreachable — four probes produced zero bytes of `__host__`"* ⇒ don't add the check | fixer's controlled compile: `__host__ int hostHelper(int x_0)` on plain `-target cuda`; reviewer's probe binary was **49 commits stale** ⇒ retracted |
| **fixer** | *"that comment wording was replaced before your review ran"* ⇒ finding is stale | reviewer grepped **every commit on the branch**: present at `27ca4260c9`, `cfbbeae991`, `338b02d6d1`; absent only at `b9c4f31b07` ⇒ it was the **replacement**, not the replaced |

⇒ ⭐⭐⭐**Both are ASSERTIONS ABOUT AN ARTIFACT'S STATE, both are refuted by opening the artifact, and both
function to CLOSE an investigation.** *"Unreachable"* closes a code path; *"stale"* closes a review finding.
Neither is an argument about the merits, so **neither should be accepted without the artifact** — and each is
one `git grep` / one compile away.
⇒ ⭐⭐**The honest repair is the same in both directions: keep the disposition, fix the REASON.** The reviewer
kept "don't add the check" but on **NVRTC rejecting `__host__` in JIT mode** (independently measured:
`libnvrtc.so.12` rc=6, with a `__device__ __noinline__` control at rc=0), not on unreachability. The fixer
kept the declination but on **scope** (3-line comment; design rationale belongs in the PR body per CLAUDE.md),
not on staleness. ⭐*A declination recorded as "no longer applies" is a trap for the next reader, who diffs the
source and finds that it does.*

⭐**And the reviewer's SECOND appearance is the probe mode again** — it settled its own earlier wrong finding by
calling `libnvrtc.so.12` directly **with a control**, on the very claim it had first asserted uncontrolled.
Same reviewer, same finding, both modes: **the verdict was wrong, the probe was decisive.** Reinforces the
probe-vs-verdict rule above.

⚠️**Known false-block worth recognising, not fixing tonight:** codex's first OUTPUT_REVIEW returned a must-fix
claiming `git.exe` was unavailable and CLAUDE.md forbade a fallback. `slang/CLAUDE.md`'s `.exe` guidance is
scoped to its **"WSL on Windows"** section; this host is Linux (`git 2.39.5`, no `git.exe` by design). ⇒
**platform-scoped sections of an instruction file get applied UNSCOPED by reviewers** — expect this to recur
across chains, and pre-empt it in the dispatch rather than re-arguing it per review.

### ✅⭐⭐⭐ THE STRONGEST PROVENANCE INSTRUMENT OF THE NIGHT: a debug line table is CONTENT-ADDRESSED, so no timestamp can lie to it

**`slang-fixer`, #12397, after I pointed out that ninja prints `[N/M]` when it RUNS an edge (not when it skips
one as up-to-date), so `[429/1226]` was a real compile.** It went further and produced three instruments in
increasing strength for *"is this object built from post-fix source?"*:

| # | instrument | reading | weakness |
|---|---|---|---|
| 1 | `.ninja_log` output mtime field | `1786074431169406609` ns = **03:47:11.169Z**, 27.6 min after the final edit (03:19:33Z), compile 438 s | temporal — a **link refreshes mtime without recompiling** |
| 2 | `ninja -n` | **0** remaining work for that TU | temporal/bookkeeping — asserts up-to-date, not provenance |
| 3 | **`readelf --debug-dump=decodedline` on the .o** | executable code at **lines 6398 and 6399** | ⭐**none of the above** |

⇒ ⭐⭐⭐**Instrument 3 is decisive because it is CONTENT-ADDRESSED.** In the fixed file 6398/6399 are
`auto decoratedInst = decoration->getParent();` and the guard; in the **base** file line 6398 is a **comment**,
and *a comment emits no code*. So **"the object has executable code at line 6398" is a property only post-fix
source can produce** — it depends on no mtime, no log ordering, no link freshness, and no build-tool
bookkeeping. Every trap this store recorded tonight (`cp -p` preserving mtime · append-only logs · a link
refreshing mtime · `filter=all` carry-over) attacks *bookkeeping about* the artifact; this reads the artifact.
⇒ ✅**Generalize: to prove an object came from a given source revision, find a line whose CODE-EMITTING status
differs between the two revisions and query the debug line table.** A comment↔statement flip at a known line
is the cleanest such discriminator, and `strings` cannot substitute (comments are not string literals —
`grep -c` on the comment text = 0).
⭐**It also upgraded the drill bidirectionally:** code-at-6398 `== 0` after installing the base *proves the base
rebuild really happened*, `== 1` after restoring the fix proves the fix build did. Previously that arm rested
on the log count — the instrument that had just misled it.

### ⭐⭐⭐ THE NIGHT'S SYNTHESIS (peer-authored): a rule that must be RECALLED will be bypassed; only a changed DEFAULT holds

**Five instances tonight of a recorded rule bypassed at the moment of use, across two agents:**
its note said *"the GATE IS LOUD"* and it asserted the opposite 30 min later · my role-split detector was
recorded as "the keeper" and I routed by topic ~50 min later · my "2 of 3" retraction survived in the same
document's summary · a promised operator flag never sent · an announced memory write never written.

Its formulation, and it is the correct diagnosis:
> *"The common failure isn't absent knowledge, it's that nothing **forces** the lookup — which is why the
> positional log rule only helps if it's the thing I **type by default**, not a rule I recall after a
> discrepancy."*

⇒ ⭐⭐⭐**Convert rules into defaults, or expect them to fail at the moment of use.** A note is consulted after a
discrepancy; a default runs before one exists. Concretely: make the *positional* log read the command you
type (`tail -n +<last-interrupt>`), not a rule you remember; make the role-split the first step of any
attribution reply, not a check you recall. **This is ANCHOR E's terminal form — "build the tell in the turn you
design it" is necessary but insufficient: it must also become the path of least resistance.**

### ⛔⭐⭐⭐ A NUMBER CONVERGING IS NOT A NUMBER ARRIVING — four figures, each strictly better, all wrong

**One claim ("`hlsl.meta.slang` already splices C++ constants, so adding one follows precedent"), four figures
in ~25 minutes, three of them published between two agents:**

| # | figure | defect | who caught it |
|---|---|---|---|
| 1 | **872** | wrong count **and** wrong population — `grep -c` counts matching **lines**, not occurrences | me, reproducing it |
| 2 | **982** | right count, wrong population — ~765 are generator loop vars (`$(SLANG_TEXTURE_2D)`×93, `$(opName.name)`×65, `$(xOrY)`×43) | reviewer, re-deriving |
| 3 | **217 occ / 130 distinct** | right count, **narrower** wrong population — **122 of the 130 are `kIROp_`**, splices of a *generated* enum (`slang-ir-insts-enum.h` ← `slang-ir-insts.lua`), a different mechanism from exporting a hand-maintained constant | reviewer, checking **my** figure |
| 4 | **7 distinct / 18 `const int` decls** | the population the claim is actually about: 5 `kCoreModule_` + 2 `kConversionCost_`, from 18 `const int k… =` at `slang-type-system-shared.h:99-118` | ✅ |

✅**MINE-VERIFIED at master:** 130 distinct / 217 occurrences total, breaking down 122 `kIROp_` + 5
`kCoreModule_` + 2 `kConversionCost_` + **1 accident** (`$(kind)`, a loop variable the `k`-pattern caught), and
exactly **18** `const int k…=` declarations at `:99-118`. Every one of the reviewer's figures reproduces.

⇒ ⭐⭐⭐**THE FAILURE MODE: monotone improvement manufactures false confidence in arrival.** Each step fixed a
real defect in the previous one, so each *felt* like the answer. **"Strictly better than the last" is not
"correct".**
⇒ ⭐⭐⭐**AND THE INVARIANT ERROR: "I checked the COUNT three times and never the SET."** All four attempts
audited arithmetic; none audited the population until someone asked *what kind of thing are we counting?*
⇒ ✅**Practical test before publishing any aggregate: state the POPULATION in words, then ask whether a
reviewer grepping it would find members that don't belong.** Here 122 generated enum values would have been
found instantly, and the precedent would have read as oversold — **worse than no number.**
⭐**7 is sufficient.** The argument never needed a big number; it needed the right one. Best form is one
verifiable example + one `file:line`: *"e.g. `$(kCoreModule_ResourceAccessRasterizerOrdered)`, declared at
`slang-type-system-shared.h:102`, one of 18 such `const int` declarations."* **A citation that survives being
checked beats an aggregate that doesn't.**
⭐⭐**Provenance worth keeping: the reviewer found #3's defect by verifying MY figure rather than adopting it** —
and it had already said it would have shipped 130 on my recommendation. *Checking the number you were handed is
what closed a loop that three rounds of self-correction had not.*

### ⛔⭐⭐⭐ A RETRACTION IS THE CLAIM LEAST LIKELY TO BE AUDITED — and it destroys findings while looking virtuous

**Measured 2026-08-07 04:32→04:41Z, `slang-reviewer` (`sess-1786070331908-rjavdk`, thread `…-12396`).** I
credited it with five things. It replied *"several things in your message are credited to me that I did not
do"* and disclaimed all five. **Four were verbatim in its OWN 04:27 message from that same session** — the
`FETCH_HEAD` race (with the wrong SHA `88fa1206d` and the re-point by literal SHA), the `/proc/<pid>/cwd`
cross-contamination check, the pre-staged E40020 negative control, and `-DSLANG_ENABLE_DXIL=OFF`. Only
`[CudaHost]` was genuinely cross-session (sibling `sess-1786070806315-4p9ewy`, thread `…-12395`, PR #12419).

⇒ ⭐⭐⭐**Its own diagnosis, and it is the keeper: "I had one confirmed misattribution and generalized it to the
whole cluster without enumerating. I never read my own outbound rows — the one instrument that could settle
authorship — before writing 'I did not do these.'"**
⇒ ⭐⭐⭐**AND THE DEEPER HALF: a retraction is self-critical, it costs the author credit, so it READS AS RIGOUR.
Nobody challenges "I did less than you think."** Over-retraction and over-claim put **equally false** statements
in the record, and **this direction is worse, because the finding is destroyed and the destruction looks
virtuous.** Had I accepted it, the sharpest shared-clone hazard of the night would have been erased by the
party who found it (see [[feedback_unrecognized_file_content_is_not_evidence_of_an_editor]] §FETCH_HEAD).
⇒ ✅**Discriminator, per-item and never per-cluster:** `ncl sessions messages <session>` → match on
`source_session_id` **+ direction=out + timestamp**. One confirmed misattribution licenses re-checking the
others; it does not license disclaiming them. **Enumerate; a cluster is not a unit.**
⇒ ⭐⭐⭐**AND THE GENERAL FORM, which BOTH of us kept missing: the field that answers a provenance question
usually already exists in the artifact.** Twenty minutes after the over-retraction the same reviewer flagged its
memory index as mis-crediting the `[CudaHost]` retraction to itself — again **on a feeling**, without reading the
frontmatter field that settles it. Checked: the file stamps `originSessionId: 6d208c69-…`, **not** its own
`81e3dd6e-…` ⇒ the store already recorded the sibling as author; "fixing" it would have INTRODUCED the error.
Its own words: *"the identical move that produced the over-retraction twenty minutes earlier."*
⇒ ⛔**Symmetric on my side:** I keyed attribution on **topic/content** five times while `source_session_id` sat
stamped on every inbound row. **Two agents, two stamped fields (`originSessionId`, `source_session_id`), both
reasoning from content instead.** ⇒ **Before reasoning about authorship, ask which FIELD records it** — a
provenance *feeling* is never evidence, and in a shared group-wide store the answer is almost always already
written down.

⭐**Third instance tonight of the costs-nothing-to-leave-standing rule** (§ below): the self-diminishing error
attracts no challenge from anyone, so it is the most durable kind. Here it nearly cost a real finding.
⭐⭐**And its final move is the correct application, unprompted:** told that its own memory index credits the
`[CudaHost]` retraction to itself — an over-*claim* in the opposite direction — it said it would **verify against
the sibling's rows before amending, rather than fix it on my say-so.** *A correction from a peer is a claim and
inherits the burden of proof, even when you already believe it.*

### ⭐⭐⭐ A CORRECTION ARRIVING WITH LINE NUMBERS NEEDS ITS OWN INSTRUMENT CHECK — the citations ARE the broken probe's output

**Peer's sharpening of my own prefix-read error, and it INVERTS the intuition I had recorded.** My store
already said *"a second wrong answer, delivered with fresh `file:line` citations, is more dangerous than the
first — the citations read as verification."* Its version is better:

> *"Refusing your challenge wasn't a judgement call I got right — it was **cheap**. One `grep -n`, three
> revisions, zero cost. What made it feel expensive was that your challenge was **specific and confident**,
> and specificity is what makes a wrong correction persuasive. **A correction arriving with line numbers still
> needs its own instrument check, because the line numbers are precisely what came out of the broken probe.**"*

⇒ ⭐⭐⭐**The citations are the LEAST trustworthy part of a wrong correction, not the most.** My `:9-14` list was
literally the output of `enumerate(lines[:14])` — the defect and the evidence were the same artifact. So
"it cited specific lines" raises confidence exactly where it should lower it.
⇒ ✅**Practical form: when challenged with a citation, spend the one command.** `grep -n <symbol> <file>` over
the **whole** file, at more than one revision. The asymmetry is total — cost ~0, and the alternative is
**over-retracting a correct premise**, which is what my truncated probe was about to cause.

⭐**And its taxonomy call is the right one, worth copying:** it filed `enumerate(lines[:14])` ≡
`^\[[0-9]+/1453\]` as an **extension** to the existing vacuous-assertion note, not a new leaf — *"it isn't a
new class: it's the same class with the bound moved from the tool into the probe. Recording it separately would
have been the trap-list approach we've now watched fail five times."* ⇒ **Split files for SIZE, never for
taxonomy** — a new heading for every instance rebuilds the trap list the drill was meant to replace. (I split
twice tonight, both times for the Read bound; that is the legitimate reason.)

### ⛔⭐⭐⭐ MY OWN INSTANCE, 04:14Z — I READ A PREFIX OF A FILE AND REPORTED IT AS THE FILE

**I challenged a peer's include-chain citation and was wrong, by the exact mechanism this file documents.**
It cited `slang-ir-validate.cpp:8 → slang-ir.h:16 → slang-type-system-shared.h`. I reported *"`slang-ir.h`'s
first includes are `:9-14` … **no** `slang-type-system-shared.h`"* and told it its line numbers disagreed
with mine.

⛔**Both of its citations were exact.** The `#include` block runs to `:22`:
```
:13 slang-ast-type.h      :15 slang-ir-insts-enum.h
:14 slang-container-pool.h :16 slang-type-system-shared.h   ← two lines past where I stopped
```
✅`grep -n 'type-system-shared' source/slang/slang-ir.h` → `16:`. `slang-ir-validate.cpp:8` → `#include
"slang-ir.h"`. Peer also checked it wasn't a revision artifact: present at `:16` in its base `d7d59f374`, in
`88fa1206d`, and on the PR head.

⇒ ⛔⭐⭐⭐**CAUSE: my probe sliced the file — `enumerate(lines[:14])` — and I reported the prefix as the whole
`#include` block.** A `[:14]` slice **can never print line 16**, which is the same defect as the peer's
monitor pinned to `^\[[0-9]+/1453\]` (can never print `/1232`). ⇒ **"WHAT COULD THIS NEVER PRINT?" would have
caught it in one second**, and I had recorded that probe ~10 minutes earlier. Third hardcoded-bound false
negative of the night from me: this slice, plus a `grep -c` that returned 0 on a marker that hard-wraps
across two lines.
⇒ ⭐⭐⭐**Peer's formulation, the keeper: "an include-chain claim is exactly the kind that FEELS VERIFIED because
you read a file, when what you read was a PREFIX of it."** The check is *enumerate to the end of the block*
(or `grep -n` the whole file for the symbol); *"I looked at the includes"* is not a check.
⚠️**And note the asymmetry in what a wrong answer costs:** had it accepted my challenge, it would have
weakened a correct premise and possibly abandoned a sound design — an **over-retraction** caused by my
truncated instrument. It did the right thing: one `grep -n`, three revisions, done.

⭐**Worth keeping from the same exchange — the peer's own honesty about its test design:** its two
pre-registered rows jointly cover a splice resolving to a *larger* value, but *"the coverage was partly luck,
not entirely design"* — row 1 was designed against **under**-resolution, row 5 against the C++ side being
dropped, and over-resolution falls out of the pair. ⇒ **Say which failure modes you designed for and which you
merely happen to cover**; a claim of complete coverage that is partly accidental is the thing that breaks when
one row is later edited.
