---
name: ""
description: "A/B suite delta protocol for a change that adds a diagnostic: same-binary baseline vs treatment, then FOUR dispositions per delta test (real finding / predicate too broad / flake / pre-existing) — re-run individually on BOTH binaries before classifying."
metadata: 
  node_type: memory
  type: technique
  originSessionId: 73c43656-0b8f-4a5b-b4d5-1c374eb48e35
---

# A/B suite delta with four dispositions

**Built 2026-08-06 on slang#12284** (new default-on warning). Reusable for any change that adds or widens a diagnostic, where "how many tests newly fail?" is the load-bearing question.

## Why a raw count is not enough

`slang-test` compares against `.expected` files. A new warning emitted during an existing test flips that test to **FAIL** without any count looking alarming. So the deliverable is a **pass/fail delta**, never an absolute failure count presented as if it were one.

⛔ **And a delta alone is still not enough**: the two arms run **sequentially under different load** (measured here: load 33 → 68 → 81 across one afternoon), and the suite has known flakes and timeouts. A spurious "newly failing test" gets classified as *"the diagnostic is correct there"*, the `.expected` file is updated, and **the corpus is silently corrupted in a way that is invisible afterwards — worse than a red CI run, because it looks like a fix.**

## Protocol

1. **Build the fix-absent binary and run the full suite = BASELINE.** Opportunistic tip: the **revert drill already produces this binary** — run the baseline arm *before* restoring the fix, or you'll have to rebuild or hedge.
2. Restore the fix, rebuild, run the **identical** command = TREATMENT. Same machine, same submodules, same corpus.
3. **Instrument self-check:** the new diagnostic's count in the BASELINE arm must be **0 by construction** (the code isn't in that binary). If it isn't 0, **report the instrument as broken; do not reason past it.** ⭐ This is a check whose *failure* is distinguishable from its *negative result*.
4. For **every** test in the delta, **re-run it individually on BOTH binaries** before classifying. This is the step that protects the `.expected` files and the one most likely to be skipped.

⛔⭐⭐⭐ **PRESERVE THE BASELINE BINARY BEFORE REBUILDING — step 4 needs it, and step 2 destroys it.** Rebuilding in the same build directory replaces the outputs in place, so the fix-absent binary that produced the baseline arm **no longer exists** by the time you have a delta to classify. Dispositions **3** (passes individually on treatment) and **4** (fails individually on **both**) are then unresolvable without another full rebuild — 25+ min under load, and you discover it at the worst moment.

⇒ Between step 1 and step 2: `cp -a build/Debug/bin build/Debug/bin.baseline` (or archive the whole config dir). Cheap, and it makes the two arms *simultaneously runnable* rather than sequential-only.
⇒ This is a protocol gap I authored and missed: the four dispositions assume both binaries remain available, but nothing in the sequence protects the first one.

⚠️ **Copy `lib` AS WELL AS `bin`.** `slangc` is a thin driver; the compiler lives in the shared library. Preserving only `bin` yields a "baseline" that **dynamically loads the NEW library** — i.e. a control silently containing the fix, reporting 0 warnings for the wrong reason and looking exactly like a correct control. Run it as `LD_LIBRARY_PATH=<preserved lib> <preserved bin>/slangc`.

⇒ **Verify the preserved control on TWO axes**, because one is insufficient: (a) it emits **0** of the new diagnostic ⇒ genuinely fix-absent; (b) it still **compiles something** (e.g. the symbol appears in output) ⇒ not a broken/truncated copy. A copy that fails to run also reports 0 — so "0" alone cannot distinguish *fix-absent* from *broken*.

### ⭐⭐⭐ How to find this class of gap: audit a protocol by asking "what does each step CONSUME?"

The peer's diagnosis of why the gap existed, and it generalizes far past this task:

> a guard gets written when you can imagine the thing going wrong, and "the artifact I'm not changing" doesn't feel like it can go wrong. Every one of my treatment-side guards came from imagining a failure of the *new code*. None came from imagining a failure of the *procedure*.

⇒ **"What could this change break?" finds bugs in the subject; "what does each step consume?" finds bugs in the method.** Silent destruction happens at consumption points — a rebuild consuming the previous binary, a `git add -A` consuming whatever is in the tree, a stash pop consuming a shared stack position, an in-place edit consuming the file a live process is reading. None of those are "changes that could break"; all are steps that *destroy an input something later needs*.

⇒ Practical form: for each step, list what it **overwrites, deletes, or renumbers**, then ask which later step needs that thing intact.

## The four dispositions

| # | Disposition | Evidence | Action |
|---|---|---|---|
| 1 | **Diagnostic correct there** | genuine case in the corpus; reproducible individually on treatment, passes on baseline | Update **that** expectation — named, with the reason, per file |
| 2 | **Predicate too broad** | fires where it shouldn't | **Fix the predicate — never the expectation** |
| 3 | **Not reproducible individually** (⚠️ *not* "flake / load artifact" — see below) | **passes** on individual re-run of the *same treatment binary* | Exclude — and **state the exclusion with the test name** |
| 4 | **Pre-existing failure** | fails individually on **both** binaries | Not yours; **remove from the delta entirely** |

- **Timeouts default to 3** pending an individual re-run (first thing to go under contention).
- ⛔ **No silent bulk re-baseline.** If any `.expected`/annotation changes, each is named with its category.

## Mechanize the buckets — and VALIDATE THE PARSER FIRST

⭐⭐⭐ **A delta parser must be validated against a synthetic fixture before you trust it, because a regex that matches nothing produces `+0 newly failing` — which is EXACTLY the result you are hoping for.** Success and broken-instrument are indistinguishable, the same shape as the `formatting.sh` trap. Push a hand-built fixture with known rows through **every** bucket and verify the classification before pointing it at real logs.

Bucket everything mechanically so nothing falls out silently (five buckets, not two):

| bucket | disposition |
|---|---|
| **NEWLY FAILING** | candidates only — each needs individual re-runs on both arms |
| **NEWLY PASSING** | report and explain; do not silently welcome |
| **FAILING IN BOTH** | pre-existing (disposition 4) — explicitly *not* your delta |
| **ONLY IN BASELINE** / **ONLY IN TREATMENT** | coverage skew — report, don't ignore |

⛔⭐⭐⭐ **NEVER ITERATE TEST NAMES IN A SHELL LOOP — they contain spaces and parentheses.** Measured 2026-08-06: `for t in $(grep … | sed …)` word-split `'tests/bugs/shadowed-lookup.slang.1 syn (llvm)'` into **three** "tests" — `shadowed-lookup.slang.1`, `syn`, `(llvm)` — each then dutifully reported as "not in baseline." **One real finding became three fabricated ones**, all plausible-looking. ⇒ Do the comparison in Python (or `while IFS= read -r`) with a line-anchored regex; never `$(…)` word-splitting. ⚠️ This is the *finding-manufacturing* failure class, which costs more than a hiding one because you act on the output.

⚠️ **`slang-test` log-format traps (measured 2026-08-06, would each corrupt the delta):**
- **Trailing space after the closing quote** on test-name lines.
- **Both `failed test:` and `FAILED test:` spellings** appear.
- A **third status `ignored test:`** exists (122 in one run). A naive `passed|failed` parser misclassifies these as *absent* and reports them as coverage skew.
- **Duplicate test names occur — take LAST-line-wins.** `slang-test` re-runs failures (`"Retrying 1 failed tests..."`); taking the first verdict counts a **recovered flake as a failure**.

⇒ Put the 3-vs-4 distinction as a comment **at the classification site in the script**, so the next reader cannot apply the protocol half-way.

### ⛔⭐⭐⭐ A SELF-AUTHORED FIXTURE VALIDATES THE CODE, NOT THE MODEL — this defeated both controls below

**Measured 2026-08-06, slang#12284 — the most important finding of that run, and a defect in the two-control recipe below.** Both controls **passed** while the parser was scoring **every failure as absent**.

Cause: `slang-test` emits failures as **`failed(pending retry) '<name>'` — with NO `test:` token.** The parser only matched `<status> test: '<name>'`. So both arms read *"0 failed"* and the delta reported a pristine **`+0`**, which would have sailed straight into the PR.

⛔ **Why the controls could not catch it:**
- The **synthetic fixture** was built from the shapes the author already believed existed. ⇒ **It tests the parser against your own model of the format. It cannot reveal a status form you don't know about.**
- The **mutation control** flipped `passed test:` → `failed test:` — *a form the parser already handled.* It confirmed nothing about `failed(pending retry)`.

⇒ ⭐⭐⭐ **Only the REAL log can expose a missing status form.** Before trusting any log parser: **enumerate the distinct status tokens actually present** (`grep -oE '[a-z()A-Z ]+ ?test:|failed\([^)]*\)' log | sort | uniq -c`) and reconcile that inventory against the parser's cases. **A form you never enumerated is a form you silently drop.**
⇒ Corollary: **`sum(bucketed) == total lines matched` by construction** — assert it. A parser that drops a whole status class still reports internally-consistent numbers.

#### ⭐⭐⭐ The cross-total assertion is the ONLY control that isn't self-authored — and it found a second defect

Adding that assertion to the same parser **immediately exposed a second, independent silent undercount**: `6403` raw status lines vs `6399` parsed names. (First hypothesis — duplicate names from retries — was **measured and refuted**: zero duplicates.) The real cause:

```
passed test: 'tests/compute/performance-profile.slang (cpu)' 60.201us
passed test: 'tests/compute/performance-profile.slang.3 (vk)' 35.7548ms
```

**Performance tests append a timing AFTER the closing quote.** The regex ended `'\s*$`, so those 4 were dropped. Fixed to `'.*$` → `6817 == 6817` exactly.

⇒ **Two independent silent-undercount defects in ONE instrument, each found by a different check, neither findable by the other:**
1. `failed(pending retry)` (no `test:` token) — found by an **impossible-by-construction result** ("the log has failures but I parsed zero").
2. trailing timings — found by the **cross-total assertion**; the first fix alone would never have surfaced it.

⭐⭐⭐ **Why the cross-total is the strongest control here: it derives its expectation from the ARTIFACT, not from your model of the artifact.** Every self-authored fixture, and every mutation of a form you already handle, is circular — it can only confirm what you already believe the format to be. A total computed off the raw log cannot be, which is why it catches the forms you never imagined.

⇒ Bake the audit in permanently: **print the raw status-form inventory per arm, flag any UNRECOGNISED token, and hard-exit if a log contains failure lines but parses to zero failures.** Then a future undercount cannot be quiet.
⇒ After the fix: **7 failures** in that baseline (6 pre-existing → disposition 4, plus the new test correctly failing with the fix absent). All 7 had read as zero.

⚠️ **Companion trap from the same hunt — the log echoes your expectation back at you.** `grep -c 38208` in the *baseline* (where the code does not exist) returned a **non-zero** hit: it matched the new test's own annotation text quoted in its failure report (`Expected: ... message containing: "warning E38208"`). The precise form `grep -cE 'warning\[E38208\]'` gives 0, as required by construction. ⇒ **When the artifact under test contains the pattern you are searching for, a loose grep measures your own test fixture.** Same family as a CI log echoing its own script.

### ⭐⭐⭐ Validate a diff instrument with a PAIR of controls, on the REAL logs

A synthetic fixture proves the parser understands a format you invented. It does not prove it handles the real one at scale. Two cheap controls, and **you need both** — they fail in opposite directions:

| control | how | proves |
|---|---|---|
| **self-compare** | diff baseline **against itself** over the real log | it does **not manufacture findings** — expect `+0`, all buckets empty (also exercises trailing spaces, `ignored test:`, retries at scale) |
| **mutation** | flip exactly **one** real `passed test:` line to `failed`, re-run | it does **not miss findings** — expect `+1`, **naming that precise test** |

⛔ **Without the mutation control, a broken parser hands you the pristine `+0` you were hoping for.** Self-compare alone cannot catch it: a parser matching nothing also reports `+0` and empty buckets. ⇒ **A `+0` is only meaningful once the instrument has demonstrated it can produce a non-zero.**

Measured cost 2026-08-06: a `head -400` and a one-line flip. Measured value: it converts `+0` from *"matched nothing"* into *"measured zero"*.

⇒ Same pairing applies to the binaries themselves: **assert the new diagnostic actually fires in the TREATMENT binary**, or an A/B can compare **two identical binaries** and report a clean `+0`.

⚠️ **Runtime expectation:** repo docs said 10–30 min per suite arm; the real pace was **~1786 tests still only ~4 of 72 test directories in**, i.e. **45+ min per arm**. Budget accordingly — and don't read a slow arm as a hung one.

## ⭐⭐ Compute every total; never type one next to the list it counts

**Two independent instances, different domains, same mechanism.** (a) This store's family-index table carried hand-typed row counts that were **stale on 5 of 7 shards within hours**. (b) On slang#12284 a fixer wrote *"6 corrections"* above a list, later appended a 7th row, and never re-counted — shipping a total that didn't sum **in the very artifact arguing that a total which doesn't sum indicates a dropped item**.

⭐⭐ **A total typed alongside the list it describes is a derived value maintained by hand — it goes stale on the next append.** The failure is silent and reads as fact, which invites arithmetic on a wrong number.

⇒ **Derive it in code** (`len(pairs)`, `grep -c`, `sum(buckets)`) so figure and list cannot drift, or **omit the number and name the command** that produces it. Applies to this technique's own delta script: compute totals, never assert them.

### ⛔⭐⭐⭐ Generalized: A DERIVED FIGURE OUTLIVES THE CORRECTION OF ITS INPUTS — 3 instances in one day

1. *"6 corrections"* typed above a list to which a 7th row was later appended.
2. **Mine:** `39 − 9 = 30 recovered`, computed while retries were still running — collapsed a **three**-state population (confirmed / recovered / **pending**) into two. Final truth: `25 + 14 == 39`, i.e. **14**. Overstated recovery **2×**, in the direction that made the delta look *cleaner* than reality.
3. A per-site drift table (`+67/+68/+71/+75/+76`) where `+67` described a **superseded** citation (`:2509`) after the corrected value became `:2510`. The citations were fixed; the offsets silently kept describing the old ones.

⇒ **Remedies, in preference order:**
1. **Compute at render** (`len()`, `grep -c`, `sum()`).
2. **Report a SUM-CHECK, never a difference** — `25 + 14 == 39` cannot hide a third state; `39 − 25` silently assumes there are only two. ⭐ Applies to any figure taken from a *running* process: assert the terminal condition (`pending == 0`) first.
3. **Write the figure last** — any number authored before its set stops changing is stale by default (a write-order hazard, not carelessness).
4. ⭐⭐ **Drop the number, keep the claim** when it is illustrative. *"Drift varies per region, so no offset validates the set"* is **stronger** than the same sentence plus a table a reviewer can check and find inconsistent. A specific figure invites verification it cannot survive.

⚠️ **Proximity to the lesson offers no protection:** instance 3 sat *inside the paragraph warning about stale figures.* Holding a rule is not applying it.

### ⛔⭐⭐⭐ A DIFFERENCE IS MEANINGLESS UNLESS BOTH OPERANDS ARE COMPLETE — and the artifact FLATTERS whichever arm is short

**4th instance, and the most dangerous.** A classifier run on partial logs reported **25 "NEWLY PASSING"** tests — every one fabricated. The treatment arm hadn't reached `tests/neural` / `tests/cooperative-matrix`, so those tests were merely **absent** from its failed set, which a set-difference reads as *"fixed."* A reviewer seeing *"25 newly passing, delta −25"* would conclude the change **fixed two dozen GPU tests.**

⇒ Same defect as `39 − 9 = 30` one level up: that one assumed **two** states where there were **three**; this assumes **both arms cover the same corpus** when one is 27% through. General form: **a difference is only meaningful when both operands are complete.** Fix is identical — **refuse until the terminal state**, never compute-and-caveat.

⭐⭐⭐ **The direction of an incompleteness artifact depends on which arm is short, and the flattering direction is the one you won't question:**

| short arm | artifact | your reaction |
|---|---|---|
| **baseline** incomplete | spurious **NEWLY FAILING** | you investigate, then dismiss — self-correcting |
| **treatment** incomplete | spurious **NEWLY PASSING** | *flatters the change* — you accept it |

⇒ Build the refusal for the flattering case first. An error that makes your work look good recruits you as its accomplice.

⇒ Make the classifier **refuse**, printing both verdict counts: `REFUSING: treatment looks INCOMPLETE (2447 verdicts vs baseline's 9029)`.

#### ⛔⭐⭐⭐ COMPLETENESS HAS TWO INDEPENDENT AXES — a volume guard cannot see the second

**The same flattering error defeated the volume guard a second time**, measured 2026-08-06. Volume looked complete (treatment 8,987 vs baseline 8,990 verdicts — inside a 95% threshold), so the classifier proceeded and reported **`DELTA confirmed-failed: -25` / `NEWLY PASSING: 25`** — *"my change fixed 25 GPU tests."* False: the **retry phase had not run**, so treatment `confirmed FAILED` was 0, and the set-difference read every baseline failure as newly passing.

⇒ **Two axes, both required:**
1. **Volume** — comparable verdict counts across arms.
2. **Resolution** — every `failed(pending retry)` mark has been confirmed **or** cleared. A mark is *not a verdict*; it is an unresolved state.

⇒ Second guard, independent of the first:
```
if marks > 0 AND confirmed == 0 AND unresolved > 0 → REFUSE
   "treatment has 29 marks but 0 confirmed FAILED and 29 unresolved —
    the RETRY PHASE has not run. Every baseline failure would read as 'newly passing'."
```

⭐⭐⭐ **A guard written against one instance of a failure covers that instance, not the class.** Both instances here were the *same* error (difference over an incomplete population) in the *same* flattering direction; the first fix (volume) was simply blind to the second mechanism. ⇒ After fixing a guard, ask **what else could produce the identical wrong output** — not whether this fix closes the case you just saw.

⚠️ **It was caught only by re-running the tool for an unrelated reason and READING the output** — not by the exit code. Flattering output does not get audited; that is the whole hazard.

⭐⭐ **Range-check the figure independently of the guard: `-25` was prima facie impossible.** A warning-only change cannot fix CUDA RPC timeouts. **Absurdity is a stronger detector than agreement** — a plausible wrong number survives review, an impossible one dies instantly. Apply the plausibility question to every derived figure *before* trusting the machinery that produced it.

⚠️ **Companion, same session:** an exit-status check read `exit=0` that was **`tail`'s** status, not the command's. Measure `TRUE_EXIT` **unpiped** (or `set -o pipefail`) — a pipe silently launders a failure into success.

## The two rules that make it honest

⭐⭐⭐ **A test you excluded is a claim you are making.** Category 3 and 4 are not disposal bins — each exclusion is an assertion that needs its own named evidence. Dropping a test silently is indistinguishable from hiding a real regression.

### ⛔⭐⭐⭐ NAME DISPOSITIONS BY OBSERVED OUTCOME, NEVER BY SUSPECTED CAUSE

**My own table above originally read "Flake / load artifact" for category 3 — a defect a peer caught 2026-08-06 before it did damage.** Naming a bucket after a *cause* invites putting anything with that cause in it. Concretely: a GPU test that fails, is retried, and **fails again** under sustained load is "obviously load-caused" — so a cause-named bucket 3 swallows it and **excludes it from the delta by name**, when it belongs in 4 (fails individually on both arms ⇒ pre-existing).

⇒ **Category 3 is defined solely by the re-run's OUTCOME: it passes individually on the same treatment binary.** Nothing about why. Since 3 is the **only** disposition that *removes* an item from the delta, a cause-based name turns it into exactly the disposal bin the rule above forbids.

⚠️ **Related terminology trap:** "flake" means *nondeterministic*. A test failing repeatedly under sustained contention is failing **deterministically in that environment** — the accurate term is **contention-induced failure**, which may or may not recover on retry. Calling it a flake asserts a nondeterminism you have not measured.

⇒ ⭐⭐ **Separate the ARGUMENT from the NUMBER.** Rest "unrelated to my change" on evidence that cannot move (the RPC-failure signature; presence in **both** arms) and report the recovered/not-recovered split as *data*. Then a rising confirmed-failure count updates a figure instead of falsifying your claim. Corollary: don't assert general properties of the suite you haven't measured ("this suite has known flaky cases") — use the operational definition only.

⭐⭐ **Disposition 4 is the one that gets mislabelled as 3.** A pre-existing failure that the two arms merely *scheduled* differently is neither a finding nor a flake. Without the "re-run on **baseline** too" leg you call it a flake and quietly take credit for a corpus that was already red. Distinguishing them costs one extra individual run per delta test.

⇒ Generalizes: **whenever comparing two runs of a nondeterministic suite, per-item re-runs on BOTH arms are what convert a diff into evidence.** The aggregate diff only proposes candidates.

See [[project_12284_cross_module_overload_silent_break_warning]] for the instance. Related: control (a) design in that memo (**design at least one control that can refute, not merely agree**).
