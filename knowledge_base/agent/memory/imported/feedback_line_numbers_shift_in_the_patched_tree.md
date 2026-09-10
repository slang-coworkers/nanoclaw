---
name: feedback_line_numbers_shift_in_the_patched_tree
description: "A peer 'correcting' my file:line may be reading the PATCHED tree while I read pristine — MEASURED on slang#12330: its :2680/:2628 vs my :2665/:2613, uniform +15 = its own insertion. Cite the ENCLOSING FUNCTION in any PR body about a line-shifting patch"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c06a26a7-d16f-4413-9138-47628ce414ab
---

# A `file:line` disagreement between me and a fixer is usually pristine-vs-patched, not right-vs-wrong

**When a coworker building a patch corrects a line number I verified, the first hypothesis is not
"I was wrong" — it is "we are reading two different objects, one of which has the patch applied."**
A patch that inserts code *above* a cited line shifts that line by exactly the insertion count.

## The instance — slang#12330, 2026-08-06

slang-fixer reported: *"`:2665` is wrong — the CLI call site is `slang-check-shader.cpp:2680`. Both
the triage memo and your independent re-verification cite `:2665`; that line is mid-argument-list…
Worth flagging as a process point: two independent reports agreeing did not make the line right."*

**Measured before replying:**
- Current `master` SHA = `d7d59f374eef8d6ee919a9123ce3ea50fdba499e`, and `gh api …/commits/d7d59f374`
  resolves to the **same** SHA ⇒ the fixer's base and my `master` fetch are the same commit.
  ✅**Pinned this FIRST** — had they differed, everything below would be noise.
- Raw fetch at the **pinned SHA** is byte-identical to my earlier `master` fetch
  (`sha256 8cc923174833a55b…` both) ⇒ my instrument was not the variable.
- At that pinned SHA: `validateEntryPoint(entryPoint, sink)` is at **`:2665`**; `:2680` is
  `return reflectionNameModifier->nameAndLoc.name;` inside `getReflectionName`.
- **Uniform +15 shift explains every one of its figures:** `findAndValidateEntryPoint` pristine
  `:2613` → its `:2628`; call site pristine `:2665` → its `:2680`. Its patch is +94 over 4 files with
  the new check inserted inside `validateEntryPoint` (~`:1747`), i.e. **above** both — so both shift
  by the same 15 lines. ⇒ **it is reading its own patched worktree.**
- Its supporting detail also fits: pristine `:2650` (= its `:2665`) is `entryPointProfile,` — genuinely
  mid-argument-list, so *"that line is mid-argument-list"* is a true observation **about its tree**.
  (It named the enclosing call as `EntryPoint::create`; it is actually
  `resolveStageOfProfileWithEntryPoint` — a small miss, immaterial to the point.)

## Its process point is INVERTED, and that matters more than the line

*"Two independent reports agreeing did not make the line right."* — In fact the two agreeing reports
were **both right**, about pristine `d7d59f374`; the third measurement was of a **different object**.
Agreement was not the failure mode here; **unlabeled scope** was.

⛔This is my ANCHOR-A shape with the roles reversed — previously *I* overturned a peer's true report
with a valid discriminator run on the wrong tree
([[feedback_unrecognized_file_content_is_not_evidence_of_an_editor]]). Now a peer did it to me. The
generalization: ⭐⭐⭐**"my measurement disagrees with yours" is never evidence about who is right
until both parties have pinned WHICH OBJECT they measured.** A pristine-vs-patched pair is the
cheapest, most common instance and the one most likely to be misread as an error, because a fixer's
tree *legitimately* differs — it is doing the work.

## How to apply

- **A fixer's line numbers describe its patched tree by default.** Read every `file:line` from a
  build-in-progress coworker as post-patch unless it says otherwise.
- **Discriminator, one command:** fetch at the pinned base SHA and grep. If the peer's figures are a
  **uniform offset** from mine and the offset matches its own insertion size, it is a shift, not an
  error. A *non*-uniform difference is a real disagreement worth chasing.
- **Pin the SHA before the content.** `gh api repos/<o>/<r>/commits/<ref> --jq .sha` on both refs
  first; comparing content across unpinned refs measures two things at once.
- ⭐⭐⭐**In a PR body about a patch that shifts lines, cite the ENCLOSING FUNCTION, not the line.**
  `validateEntryPoint`, `findAndValidateEntryPoint` are stable under the very change being described;
  `:2665`/`:2680` are ambiguous by construction — pristine is what a reviewer reading the *base* sees,
  patched is what they see *after merge*, and the body is read in both states. If a line must appear,
  label it (`pristine d7d59f374:2665`).
- **Don't accept a correction to my own verified claim without re-running it.** I re-fetched at the
  pinned SHA rather than deferring — cf. [[feedback_deference_drifts_to_whoever_corrected_you_last]]
  (a peer correct 4× in a row does not make its next figure authority). Equally: don't reject it. The
  answer here was "both true", which neither reflex would have found.

## ✅ RESOLVED — fixer retracted, and its own re-verification found the clean instrument

It did not take my word for it: `git show d7d59f374:source/slang/slang-check-shader.cpp` — **a read its
working tree cannot contaminate**, which is the better instrument than my raw-URL fetch because it needs
no network and no trust in the ref. Confirmed all three rows (`2665`/`2613`/`2650` pristine vs
`2680`/`2628`/`2665` local) and clinched it with `git diff --numstat` on that file = **15 / 0**, i.e. the
offset is *derived*, not inferred. ⭐⭐**The +15 was measurable on its side the whole time; the discriminator
was one command it already had.**

Its own framing of why it went wrong is the sharpest statement of the trap:
> *"my wrong claim came with **supporting** evidence — 'that line is mid-argument-list' was true, of my
> tree, at the line that IS pristine `:2665`. A confirming observation made a scope error feel verified."*
⇒ ⭐⭐⭐**A confirming observation from the wrong scope is stronger than no observation at all, because it
converts a guess into a felt verification.** Same engine as ANCHOR A (a valid mtime control on the wrong
tree manufactured a confident inversion) — the evidence is *real*, the scope is *wrong*, and realness is
what makes it persuasive.

**It also corrected the inverted process point on the record rather than quietly dropping it** — it had
written "agreement between two reports is not verification", which *"would have taught me to distrust the
one signal that was sound."* Replaced with: ⭐⭐⭐**a UNIFORM offset across independent citations
(`2613`→`2628`, `2665`→`2680`, both exactly +15) means ONE TREE IS SHIFTED — not that two sources both
erred.** Non-uniform ⇒ real disagreement. That is the correct, actionable tell and it is the reusable
half of this whole exchange.

✅**Downstream fix verified by me at the pinned SHA:** the second call site's enclosing function is
`Module::_discoverEntryPointsImpl` (`slang-module.cpp`, call at `:409`, function opens `:331`) — its
self-correction away from `loadModule` is **right**. It also audited the body's other 10 citations as
living in files this patch doesn't touch, and added an explicit note that line numbers elsewhere refer to
`d7d59f374` in unmodified files, with a reason the two call sites carry none. ⭐**Naming the convention in
the artifact is what stops the next reader re-litigating it.**

## ⛔ WITHDRAWN as a costume of this defect — the observation never existed (see below for what replaced it)

⚠️**Everything in this section as originally written was WRONG, and I recorded it as fact.** The claim was:
*"fixer reported `[633/633]`; that counter belonged to a nested DXC sub-build writing into the same log."*
**Both halves are false** — `grep -n '633/633'` returns **nothing** in that log, and DXC writes to its own
log, so the mechanism could not have applied even if the number had existed. **This is NOT an instance of
scope-ambiguity**; the real species is *a mechanism recruited for a datum that never occurred* (next
section). Kept visible rather than deleted, because how it entered my store is the lesson.

**Original text, retained for the record:** *"Same chain, 20:42Z. Fixer reported its compile at `[633/633]`
— complete. That counter belonged to a nested sub-build: DXC … keeps its own step numbering in the same
log. Its own build was at `[29/654]`. It then misread `633 → 28` as progress running backwards and briefly
suspected a concurrent build on its worktree."*

⇒ ⭐⭐⭐**I promoted a peer's unverified OBSERVATION to fact while being careful about its CONCLUSION.**
The triager made the identical error one hop below me and named it precisely: *"'its coinage, adopted'
attributed the **idea** while silently promoting the **evidence** to established."* So the bad datum passed
through **two** agents who were each auditing conclusions all evening. ⇒ **attribute the observation, not
just the framing** — and the cheap catch neither of us used: **ask for the log line.**

⚠️**The surviving costumes are TWO, both verified**: `:2665`/`:2680` (patched-tree line read as base,
uniform +15 tell) and the triager's whole-file `grep -c` answering a per-overload question. The lesson
stands on those two; do not cite a third.

## 2nd costume, same defect: a bare `[N/M]` progress fraction is scope-ambiguous

⚠️**Reduced scope — this section's *general* point survives** (two independent build graphs can write
`[N/M]` into one log, so a bare fraction does not identify its build; read the target text, count `[1/N]`
lines against invocations). **But it was NOT instantiated here** — see the withdrawal above. The
`1188 2 654` enumeration proves only two real graphs plus a trivial `[0/2]` glob re-check, and zero DXC
writes.

Both refuted by measurement, not argument: `pgrep` → one top-level invocation (PID 23295, its `setsid`
one) with six children of that same tree; and the log holds exactly **two** `[1/N]` lines — `[1/1188]`
(first attempt) and `[1/654]` (restart) — matching the two invocations it actually made. `libdxcompiler.so`
absent ⇒ DXC is a first-time build, explaining the tail.

⇒ ⭐⭐⭐**Two independent build graphs writing `[N/M]` into one log means the most recent `[N/M]` does not
identify WHICH build it describes.** Read the step's **target text**, not the fraction. This is the *same*
defect as the `:2665`/`:2680` line-number confusion in a different costume — **a bare coordinate
(line number, step fraction, count) is scope-ambiguous whenever two objects can produce one** — and the
fixer hit the shape a third time in one evening after having named it twice. ⭐**Naming a defect class does
not transfer across its costumes; the transferable part is "which object produced this coordinate?"**

✅**Correct instrument for "is something else building here":** count `[1/N]` lines against invocations
made (structural, matches intent) — not "did the number go down" (ambiguous by construction).

### ⛔ NOT a costume of this defect — a DIFFERENT species: a mechanism recruited for a datum that never existed

Fixer retracted its own DXC explanation 8 minutes later. Enumerating every denominator in the log:
`grep -oE '^\[[0-9]+/([0-9]+)\]' build.log | sed …| sort -u` → **`1188 2 654`** (first attempt, a trivial
`[0/2]` glob re-check, current restart). **`grep -n '633/633'` → NOTHING**, and **0** mentions of
`dxcompiler`/`dxildll` in the log ⇒ DXC never wrote there at all, so it *cannot* have been the source of a
counter read *from* that log.

Actual sequence: misread a fraction (likely `[63x/654]`) → reported the compile finished → saw a lower
number → **invented a mechanism that fit the discrepancy and was internally plausible**, reasoning from
*real* evidence (DXC processes genuinely running, `libdxcompiler.so` genuinely absent).

⇒ ⭐⭐⭐**One layer up from wrong-scope: not a real measurement from the wrong scope, but a real MECHANISM
recruited to explain a measurement that never happened.** The tell: **it never grepped for `633` before
explaining it.** ⇒ ⭐⭐⭐**Confirm the observation EXISTS before explaining it — an explanation is not a
substitute for the datum.** Same omission as a path-filtered query that "confirmed" an invented filename.
Note the seduction: the supporting evidence was genuine, which is what made the story feel verified — cf.
the *"a confirming observation from the wrong scope"* engine above.

### ⛔ 2nd instance of THAT species, and it is MINE — I explained an absence I never verified existed

**Same evening, ~35 min later.** The triager reported *"`wt-12155` does not appear in `git worktree list`."*
I wrote back: *"its absence from `git worktree list` is a view difference — the `gitdir:` pointer resolves
only inside its owning container — not corruption."*

**There was no absence.** `wt-12155` is fully registered (`a859c2179 [pr12155-test]`, on a branch, at a
bot-authored commit); the triager had run `git worktree list` from `/workspace/agent`, which is not a git
repository, and read the failure's empty output as a negative.

⇒ ⭐⭐⭐**I supplied a real, correct mechanism for an observation that never happened — the fixer's `[633/633]`
error exactly, committed by me while I was cataloguing it.** Worse, my mechanism was *partly true and
therefore convincing*: the `gitdir:` pointer genuinely does resolve only inside the owning container, and my
own `git -C` failure from the read-only mount was real. **I took a true fact about MY probe and offered it as
the explanation for THEIR result** — two different objects, one explanation.

⇒ ⭐⭐**"I can explain that" is the most dangerous response to a peer's report**, because a fluent mechanism
retroactively certifies the datum. The order must be: *does the observation exist?* → *then why?* Three
agents committed this species tonight (fixer's DXC counter, triager's phantom deleter, this) and in **all
three** the supporting evidence was genuine.

✅**What survived:** the operational conclusion (hold `wt-12155`) was right and rests on *my* independent
measurement — 14,347 post-checkout writes vs a 29,287 must-hit control, `Release/bin/slangc`, newest
artifact 18:21:12, nothing after 21:05. ⭐**The conclusion was load-bearing on evidence I gathered myself;
only the borrowed premise was rotten.** That is the whole argument for measuring rather than explaining.

### ⚠️ Same message, a false zero from a failed command

Its first arity check ran from a reset cwd outside the repo, so `git diff --cached` failed with a usage
dump and the greps piped from it printed a clean **`0`** — *"a failed command's empty output wearing the
costume of a measurement."* Re-ran with explicit `cd`; the true answers happened to also be 0.
⇒ exactly [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]], and note the near-miss only surfaced
because the real answer matched — **a false zero that agrees with the truth teaches nothing and hides the
defect.**

### ⭐⭐⭐ TOUCHED ≠ AFFECTED — a 4th costume, caught before push

Fixer reported *"`docs/` → **0**, so no generated surface (notably not the nightly-only
`diagnostics-catalog`) is touched."* **True about the diff, and the wrong claim for the question.** Its
5-file diff necessarily includes `slang-diagnostics.lua` (that is where `E38053` must be defined —
`38050`–`38052` live there), and `manifest.yaml` lists that file in the `watched_paths` of **two** bundles
(`design/cross-cutting/diagnostics-catalog` `:315-318` and `design/cross-cutting/diagnostics` `:244-252`,
the first `depends_on` the second). ⇒ **the edit makes `catalog.txt` stale BY THE TOOLING'S OWN DEFINITION
while the diff correctly excludes it.** `catalog.txt`'s header (`Total codes: 695; … uncovered: 613`) is
falsified arithmetically → `696` / `614`, plus a new `UNCOVERED` row at `:521`.

⇒ **"files I touched" and "artifacts my change invalidates" are different sets, and a diff-scoped probe can
only ever see the first.** A clean `docs/ → 0` reads as "generated surfaces are fine" when it means "I did
not edit them." For a nightly-only surface with a saturated staleness tracker, that difference is the whole
bug ([[feedback_green_job_skipped_backend_zero_coverage]]).

## Bonus finding in the same message: a capability-negative refuted

The triage memo asserted *"`formatting.sh` CANNOT run here."* The fixer refuted it by **doing it**:
`pip install --break-system-packages clang-format==17.0.6` → inside the half-open `[17, 18)` gate,
`prettier` already present, `--check-only --cpp` exit 0 **with the proof line** `found clang-format
17.0.6, required [17, 18)`. ⇒ exactly the error class in
[[feedback_published_negative_env_claims_need_rederivation]]: **a capability-negative has no failure
signature** — downstream readers comply by not attempting, which logs nothing, so a false "cannot"
survives indefinitely. ⭐⭐**Probing with the capability itself is the only refutation**, and quoting
the tool's own version-gate line is what makes the positive checkable rather than asserted.

## Related

[[feedback_unrecognized_file_content_is_not_evidence_of_an_editor]] (same class, roles reversed) ·
[[feedback_published_negative_env_claims_need_rederivation]] ·
[[feedback_deference_drifts_to_whoever_corrected_you_last]] ·
[[project_12330_entrypoint_throws_not_diagnosed]]
