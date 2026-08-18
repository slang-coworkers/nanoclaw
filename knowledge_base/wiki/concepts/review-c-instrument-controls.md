---
title: "Instrument discipline for review work — controls, false zeros, census, guards, units"
type: concept
group: review
tags: [instruments, false-negative, positive-control, census, grep, guards, unit-mismatch, enumeration, scale-error]
source_count: 13
---

## TL;DR

Across an approver/reviewer chain, nearly every wrong answer came from a **broken measuring
instrument** whose output was shaped like a result — and every catch was mechanical, not
argumentative. The transferable artifact is the taxonomy of instrument failures and the
distinct move each one needs.

- **The four (five) instrument-failure variants:** a negative control that can't separate the
  two cases (fabricates *a signal*); a positive control failing structurally / a wrong path
  (*a void*); a fallback behind a pipe (*absence as silence*); searching your own logs for a
  term you've discussed (*presence*); a write that no-ops but returns success (*an
  accomplished change*). Each needs a different check.
- **Enumerate, don't sample; and enumerate over the right *population*.** A one-level pattern
  match answering a transitive question is confidently wrong and fails silently.
- **Print the census, never the total** — a total is blind to composition by construction, so
  a right total can be assembled from wrong members.
- **When a census splits a set into buckets, check the buckets sum to an independently-counted
  total** — one addition beats inspection *and* peer review.
- **A guard that prints its verdict instead of `exit 1` is theatre.** `pgrep -f` self-matches
  the shell asking the question — anchor on the executable (`pgrep -x`).
- **A near-miss in a figure is a boundary, not noise** — version, unit, scope, arrival,
  category. Publish a size with its unit *and* name the bound before the unit.
- **Read the error message, not just the status code:** GitHub 404s distinguish wrong-ref
  ("No commit found for the ref X") from wrong-path ("Not Found") for free.
- **A working fix is not evidence for the mechanism you attach to it** — vary one axis before
  publishing a cause.

---

## The instrument-failure taxonomy

Four distinct failures, each nearly producing a confident wrong answer, each caught by a
*different* move — no single discipline covers them:

| # | broken instrument | fabricates | caught by |
|---|---|---|---|
| 1 | negative control that can't separate the two cases (clean pair used different files; real case same-file) | **a signal** | build the control to differ in **exactly one variable**; never a strictly-easier instance |
| 2 | positive control failing **structurally** (404 because artifacts live under a subdir, not root) | **a void** | verify the **path** resolves before reading; a failing control means fix the probe |
| 3 | fallback behind a pipe: `grep … \| head -1 \|\| echo "(none)"` | **absence as silence** — `head` succeeds, `\|\|` is dead code | check the **fallback branch can execute**; point it at a case you know lacks the pattern |
| 4 | searching **your own logs** for a term you've been discussing | **presence** | require the **exact emitted literal** — prose paraphrases, code emits verbatim |
| 5 | a state-changing call whose response can't distinguish success from no-op | **an accomplished change** | verify through a **different channel than you wrote through**; report writes as attempts |

**#4 is the one to lead with: it is the only variant where the control *passed* and was still
worthless** — the corpus (your own transcripts) contains discussion *of* the target, which
keyword-matches it; the more attention you paid, the surer a topical search is to "confirm."
Discriminate by specificity (the exact host string, e.g. `approval decision joined to human
verdict`, gives 0 where the keyword gave 3 files) and by line shape (host lines carry a
structured `[tag]` prefix; transcript hits sit mid-sentence). **Never grep your own
logs/memory to confirm an external event occurred** [[approver/challenger-miss] A positive control can match your own writing ABOUT the artifact — grepping my session logs for record_human_verdict "hit" because I'd been discussing it for an hour; only the exact emitted string discriminates](../learnings/1785948222130-approver-challenger-miss-a-positive-control-can-ma.md).

**#5 is worse than a read failure**, because you build on it. `record_human_verdict` is a
documented host-side no-op when no row exists, yet almost certainly returns the same success
string. The standing checklist before trusting any probe: (1) could this match have come from
something *other than the event*? (2) does my control differ in exactly one variable? (3) does
the path/reference resolve, and is my control passing for the right reason? (4) can the
negative branch actually execute? (5) for writes, does the response distinguish success from
no-op, and have I confirmed through another channel? (The consolidated four-variant table and
its `head_advanced` backfill guard are recorded with the approver ledger discipline on
[[wiki/concepts/review-c-approver-decision-procedure.md]].)

### Variant 3 in detail: the fallback behind a pipe

```bash
grep -ioE "$pat" "$f" | head -1 || echo "(none)"   # BROKEN — pipeline exit is head's, always 0
hit=$(grep -ioE "$pat" "$f"); printf '%s\n' "${hit:-(none)}"   # capture + expansion
grep -ic "$pat" "$f"                                # or count: 0 is a real answer that PRINTS
```

`| head` makes the pipeline's exit status 0 regardless of grep, so the `||` fallback can never
fire — every "absent" case prints silence, indistinguishable from a measured "nothing found."
The deeper lesson: the first response to garbled instrument output was to rename it ("the grep
collapsed the output") and switch construct — the right answer then came *by luck of construct
choice, not from diagnosing the bug*. **When an instrument's output looks odd, diagnose it
before reformatting it; a right answer obtained after an unexplained anomaly is unverified.**
Prefer a count over a presence test (`0` prints), and run the negative case explicitly against
a file you *know* lacks the pattern [[approver/critique-mustfix] I hit the `grep | head || echo` exit-status bug too and misdiagnosed it as "grep collapsed the output" — the right answer came from switching construct by luck, not from understanding; a fallback behind a pipe can never fire](../learnings/1785947082592-approver-critique-mustfix-i-hit-the-grep-head-echo.md).

### Variant 2 refined: the 404 body already discriminates

Wrong-ref and wrong-path 404s *are* distinguishable, for free — the discriminator is in the
response body, not a second probe:

```
wrong REF, good path :  {"message":"No commit found for the ref main", "status":"404"}
good ref, wrong PATH :  {"message":"Not Found", "status":"404"}
```

`gh` surfaces the status code prominently and the JSON body incidentally, so the instinct is
to branch on the status — which conflates two causes. **Branch on the error message, not the
status code; the status is a summary, the body is the artifact.** Read `default_branch` before
constructing any cross-repo path (in this org, `master` for slang and `main` for slangpy —
assuming either burns you on the other). Keep the positive control as backstop for the
typo'd-path case the message can't distinguish. *When you file a lesson about an instrument,
check whether it was actually telling you more than you read*
[[approver/clause-gap] Wrong-ref and wrong-path 404s ARE distinguishable — GitHub returns "No commit found for the ref X" vs generic "Not Found", so reading the message (not just the status) discriminates probe-fault from content-absence for free](../learnings/1785948754357-approver-clause-gap-wrong-ref-and-wrong-path-404s-.md).

## Enumerate over the right population; print the census, not the total

**A competent enumeration over the wrong population is confidently wrong** — and peer agreement
is not corroboration when everyone used the same instrument. A `grep "public Base"` finds
*direct* inheritors by construction; it cannot see a concrete class two levels down, and it
returns a tidy list instead of an error, so the blind spot silently becomes a claim. On
slang#12342, four independent actors produced the same wrong set for an interface-implementor
question by enumerating base-subclasses. **Ask *did we use different instruments?* before
treating concurrence as evidence.** State the population in the question's own words
("implementors of interface I" ≠ "subclasses of base B"); **traverse, don't pattern-match**;
classify before counting (abstract classes are conduits, not carriers); and **exclusions are
the highest-value claims to double-check** — a wrong exclusion is invisible in the output
[A competent enumeration over the wrong population is confidently wrong — and peer agreement is not corroboration](../learnings/1785967788420-a-competent-enumeration-over-the-wrong-population-.md).

**Print the census, never the total.** Two agents counted `IComparable` methods on `CoopVec`
as 2 and 3; both wrong. The "3" was *right by coincidence* — printing the hits showed a doc
comment + `equals` + `lessThan`, and the disputed method (`lessThanOrEquals`) never matched,
because `lessThan` is a strict **prefix** of a longer sibling identifier so the trailing `\b`
and `(` fail. **A total is blind to composition by construction — any three things sum to
three.** The cheap correct instrument neither reached for: read the interface, enumerate what
it *requires*, check each requirement against the implementer (with a guilty control for a
method it does *not* require). **A disagreeing figure is a reliable defect DETECTOR, not a
verdict on which figure is right — audit both, especially the one that appears to have caught
the other.** Of seven defects in that chain, four surfaced from a disagreeing figure and zero
from re-reading prose ⇒ **exchange numbers, not conclusions, and send the census under the
count** [Print the census, never the total — and a disagreeing figure is a defect detector, not a verdict on which figure is right](../learnings/1786054205857-print-the-census-never-the-total-and-a-disagreeing.md).

**The partition control.** When a census splits a set into buckets, count the whole set
independently and check the buckets sum to it — **one addition beats inspection and peer
review.** A published 60/78 disabled/live census (each bucket individually plausible, having
survived a per-file read *and* a peer review) was wrong both ways; `grep -hE '^…' | wc -l` =
136 ≠ 60+78. A partition that doesn't add up is wrong even when every bucket looks plausible.
Two supporting notes from the same exchange: a grep's aperture is sound *per-directory*, not
per-command (verify the soundness *argument*, not just the result — a search complete by luck
of vocabulary is near-blind one directory over); and a length figure names a unit, or two
correct measurements read as drift [Partition control: when a census splits a set into buckets, check the buckets sum to an independently-counted total — one addition beats inspection and peer review](../learnings/1785962802817-partition-control-when-a-census-splits-a-set-into-.md).

## A near-miss in a figure is a boundary, not noise

Two agents reported file sizes differing by 40 B and 57 B — neither divergence nor a
concurrent write: **one measured characters (`len(str)`), the other bytes (`wc -c`)**, and
emoji/arrow-dense markdown runs ~0.5–1% larger in bytes. The direction is stable (bytes ≥
chars), so it reads as "the file grew." A near-miss is always a **boundary** — the known ones:
**version, unit, scope, arrival, category** — and guessing between them is unnecessary; the
discriminator is one command (`len(s)` vs `len(b)`; equal ⇒ pure ASCII).

Three compounding rules from the same corpus:
- **Publish a size with its unit** (`7777 B` / `7720 chars`), and **name the bound's
  convention too** — `24.4 KB` is `24,986 chars (24.4×1024)` or `24,400 (×1000)`, 586
  characters apart. A unit hides best inside a *derived* quantity: two row-counts differing by
  a constant were fed by `×1024` vs `×1000`, and both agents audited the counting aperture,
  neither the constant they divided by. **Audit the constants that feed a figure, not just its
  method.**
- **Name the bound *before* the unit.** A "back at the 17.1 KB bound" alarm was a false alarm
  under 3 of 4 unit conventions — but the decisive defect was that two bounds were in play
  (17.1 KB compaction-advice vs 24.4 KiB loading bound) and the alarm compared against the
  wrong one.
- **The fifth boundary — category — is the only one whose output is an AUTHORIZATION.** The
  first four produce a re-derivable figure that self-corrects on contact with a second
  measurement; category produces a change that gets *made and not revisited*. A gate held
  "until a second independent incident" was satisfied within the hour by an *unrelated* defect
  class, because "a second independent incident" is an unbounded predicate that never says *of
  what*. **A gate must name its defect class, not an incident count** — and any "the gate is
  met" claim must name the mechanism and show the defect class's vocabulary is present in the
  evidence. And a symmetric defect's natural summary sentence assigns blame to one side
  because narrative wants an erring party — write "both omitted the unit" even when one number
  matched the byte count [A near-miss in a file size is a UNIT mismatch before it is a divergence — len(str) counts characters, wc -c counts bytes, and emoji-dense markdown differs by 0.5-1%](../learnings/1785969955141-a-near-miss-in-a-file-size-is-a-unit-mismatch-befo.md).

The scale-error variant: a published binary-size ratio "1.88×" should have been **1.96×** — a
**MiB numerator divided by an MB denominator** (`4.73 MiB = 4.9313 MB`; the `1048576/1e6`
factor is exactly 4.86%). **~4.9% is the worst possible band** — too small for a range check to
fire, too large to be rounding — so it survives review by *looking reasonable*. The
detectors need nothing external: **numerator, denominator and quotient were all in the same
table row — one division catches it**, and **a scale error does not produce a constant offset**
(the absolute miss grows with the ratio, so "every ratio is ~4.9% low" is the right
characterization). Two more transferable observations: **two figures that will not reconcile
can mean different MEASURANDS, not an error** (`+60.5%` on a `.rodata` *section* vs `×1.96` on a
*symbol* — a section ratio *must* understate a symbol ratio; the tell was that applying +60.5%
to the base gave a number nowhere near the symbol figure); and the correct downstream behaviour
when two unreconciled numbers circulate is to **refuse to quote either and escalate**, not to
pick one. Note the error *understated its own conclusion* (the margin was wider than claimed),
which is why a self-correction can strengthen rather than weaken the original call
[CORRECTION to my g_coreModule learning — 1.88x should be 1.96x, and its calibration sentence is half-cleared](../learnings/1786042396996-correction-to-my-g-coremodule-learning-1-88x-shoul.md).

## Guards that don't guard

Two defects in one three-line precondition check, both reading as protection in a transcript,
neither protecting anything:

1. **The guard narrated instead of enforcing.** `pgrep -f 'ninja' && echo "abort" || echo
   "clear"` then builds anyway — `echo "abort"` is not `exit 1`. **If a check is a
   precondition, it must terminate:** `pgrep -x ninja && { echo ABORT; exit 1; }`. The
   contrast: a payload-size guard `test -s body.md || { echo ABORT; exit 1; }` in the same
   hour *did* fire and stopped a `gh api --method PATCH` from blanking a verified public
   comment — the difference was solely whether the guard had teeth.
2. **`pgrep -f` matched the shell running the pgrep.** `-f` substring-matches the full command
   line of every process, including the one whose argv *contains the pattern* — so a "is X
   running?" probe reports yes purely because you asked. Anchor on the executable: `pgrep -x
   ninja`.

The stakes: the guarded build was a *revert* rebuild restoring pristine binaries. **Reverting
source is not reverting the build** — after any temporary patch, check the artifact (put a
known-present must-hit string in the same command as the string you're testing for, so a false
zero can't masquerade as absence), not the build's exit code
[A guard that prints its verdict instead of exiting is theatre; and pgrep -f self-matches your own command line](../learnings/1786038047034-a-guard-that-prints-its-verdict-instead-of-exiting.md).

## A harvester is itself an instrument

A blast-radius tool built after deleting a neighbouring index block *missed the very block
whose loss prompted it* — its label regex required the bold span to close immediately after
the caps run, and the real label continued in mixed case. **A harvester needs the same
validation as any other instrument: run it against the artifact that broke.** A fixture built
to demonstrate the bug can pass while the production file fails, because the fixture inherits
your assumptions about the format. Corollaries: **harvest the expected set from the artifact,
never type it** (a hand-typed expected set produced a MISS for a section that never existed,
nearly "restoring" phantom content); and **don't inherit a remedy whose premise you haven't
run locally** — a peer's "when a structure needs ever-more-careful placement, the structure is
the defect" holds only when budget-per-entry < filename length, and is *false* with headroom,
where over-budget is a prose problem [A harvester is itself an instrument - my blast-radius tool missed the very block whose loss prompted it](../learnings/1785965956339-a-harvester-is-itself-an-instrument-my-blast-radiu.md).

**Audit printed-verdict against exit code on every arm of every tool.** The procedure found a
real bug on first application: `fragcheck <missing-file>` returned exit 1 (MISS = "measured,
genuinely absent") when nothing was measured — an unreadable haystack must be 2 (CANNOT
VERIFY). **The arm you never take is the arm that lies** (the error path had only ever been
run against an *empty* file, never a *missing* one). On a tool with agreeing verdict/status
arms, a mismatch is always a **harness bug, never a logic bug** — which stops you patching
correct code. **An unhandled exception is an exit-code claim you did not write** (Python's
traceback exits 1). And the finding that can't be tooled: **a rule is at its weakest precisely
when you are working on the rule** — the attention that should check the mechanics is spent on
the abstraction; the honest record is "known failure mode, no countermeasure"
[Audit printed-verdict against exit code on every arm - the procedure found a real bug in my own tool on first application](../learnings/1785966436747-audit-printed-verdict-against-exit-code-on-every-a.md).

## A working fix is not evidence for its mechanism; markdown breaks literal grep

Verifying a claim reached a public artifact, a literal `grep -cF 'Deliberately not used as a
control'` returns 0 because the body says `Deliberately **not** used as a control` — inline
markdown (`**`, backticks, line-wraps) breaks the match, and the failure runs both ways (you
"correct" an accurate artifact, or report a peer's true finding as missing). **The principle
"a grep miss is not an absent claim" was filed three times as a principle and kept failing to
fire — because no file carried the corrected command.** The runnable fix: collapse whitespace,
strip inline markup with `sed`, and pick the shortest distinctive *unformatted* substring;
pair every absence sweep with a **must-hit** fragment you know is present (if the must-hit also
reads 0, the instrument read nothing and the sweep is void). `grep -c` counts *lines*, `grep
-o | wc -l` counts *occurrences* — use `-c` for existence only. **A rule stated as a principle
discharges the felt obligation without running the check; file the command**
[Markdown emphasis inside a phrase breaks literal grep - the runnable fix, not just "a grep miss is not an absent claim"](../learnings/1786003526432-markdown-emphasis-inside-a-phrase-breaks-literal-g.md).

The self-sealing version: **a working fix is not evidence for the mechanism you attach to it.**
A dedup query that changed *two* variables at once (new wording *and* dropping `in:body`)
succeeded, and credit went to the variable already in mind (wording), producing a wrong cause
riding a working remedy. **Vary one axis before publishing a cause** — and when a hit is
expected but absent, flip the cheap structural axis (qualifier/scope/surface) *before*
rewriting content. (This atom's full dedup-aperture content is on
[[wiki/concepts/review-c-pr-review-practices.md]].)

## Instrument traps specific to CUDA / nvcc review

Two instruments produced confident wrong answers on a CUDA-prelude review before their controls
caught them, both recurring on any CUDA prelude change:

1. **`-Xcompiler -funsigned-char` reaches only the HOST compiler.** nvcc's device compiler pins
   `char` signed regardless (verified: `std::is_signed<char>` = 0 host, 1 device), and you
   cannot route the flag to the device side (`-Xcicc`/`-Xcudafe` reject it). Prelude operators
   are `SLANG_CUDA_CALL` = `__device__`, so a host-side measurement is off-path by
   construction — **check that macro before designing any prelude experiment**, and say "cannot
   measure here" rather than reporting the host-flag result.
2. **A compile-error "control" can be a FALSE POSITIVE.** An injected `(unsigned char)`
   returned rc=2 — but from the pre-existing CUDA 12.6 `__half2` operator-redefinition clash,
   present before and after any edit. **Prefer value-discriminating controls over
   compile-error controls when the header has ambient errors** (inject a bug that compiles for
   every type and *changes a value*).

Bonus, generalizable to any width-dispatched macro: **token-pasted width dispatch is loud only
in one direction** — `BODY_2` on a 4-component result compiles silently with `.z`/`.w`
unassigned. Test the *narrow* direction too before accepting "a mismatch is a compile error,
not a silent miscompile." And a UB claim not manifesting under `-fstrict-aliasing` does not
refute it — UB not manifesting is the expected case
[CUDA prelude review: two instrument traps that fake a result (host-only -funsigned-char, __half2 false-positive control)](../learnings/1786045749799-cuda-prelude-review-two-instrument-traps-that-fake.md).
