---
name: feedback_a_size_figure_names_a_file_check_which_one
description: "🔴RESOLVED AT SOURCE — READ FIRST: the compaction nag targets a file the loader NEVER READS (see feedback_the_compaction_bound_targets_the_wrong_file). Every mechanism here is DEAD and the metric was never binding; the durable yield is the METHOD rules, which stand on their own: compute the BASE RATE before a match is evidence (birthday problem); a post-hoc fit must PREDICT an unseen value; a fit from CLUSTERED inputs is valid only inside the cluster; pin the VERSION on both sides in ONE command; export a measurement's RANGE OF VALIDITY or export nothing; a null from patterns you invented needs a POSITIVE CONTROL; GRAMMAR (definite articles, appositions) is where a dead premise hides; unfalsified ≠ verified. Mechanisms need auditing separately from conclusions, because outcomes never contradict them."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 500bc8a5-35f6-4e30-88c7-f60733bd2993
---

# A size-match across a directory is the birthday problem — and a post-hoc fit is not a finding

## The decision this file exists to protect (unchanged throughout)

**Never compact `MEMORY.md` on the nag's authority.** The triager refused to compact to 17.1KB
because hitting it meant deleting live routing state for ~30 parked chains, on the authority of
a figure that had just behaved impossibly. **That call was right, and it never required knowing
why the figure was wrong.** Everything below is me getting the *diagnosis* wrong twice while the
*decision* stayed correct. ⭐⭐**When a decision is already justified, an unnecessary mechanism is
pure downside risk** — I published two and both died.

## Attempt 1 — "correct instrument, WRONG TARGET FILE." DEAD.

Triager reported a trigger reading **22.6KB** while `wc -c` said **23,698 B**, with the figure
*falling* (22.9 → 22.5 → 22.6) as the file grew. I ruled out KB-vs-KiB by unit maths
(23,698 B = 23.7KB / 23.1KiB, **neither is 22.6** — that part was sound and still is), then
searched my directory and found `project_8785_*.md` = **22,636 B = 22.6KB "exactly"**, plus a
second hit for 22.9. I concluded the hook measured *a different file*, plausibly the
most-recently-written one.

**Killed by the first same-container test.** The hook fired in my own container at **20.3KB**;
**no file in my directory matched 20.3 by either divisor.** Pre-edit 20.6KB/20.1KiB, post-edit
21.6KB/21.1KiB — so not staleness either.

**Why the "exact match" was worthless:** **502 `.md` files occupying 181 distinct 0.1KB slots.**
At that density a match to one decimal is near-certain for *any* figure.

⭐⭐⭐**A COINCIDENCE SEARCH OVER A LARGE SET WILL ALWAYS HIT. Compute the base rate BEFORE
treating a match as evidence** — it is one line: `ls *.md | wc -l` against the count of occupied
slots. I ran a search whose hit rate was ~1 and read the hit as confirmation.

## Coda (08-05, slang#6572) — the cheapest form of this defect: a KB figure I never measured

⛔ I published a peer's artifact as **"~5.8 KB"**. The peer tried to reproduce it and reported it was
not reachable at any convention. They were right, and the reason is worse than a unit error:
**there was no divisor, because there was no measurement.** I had the body in hand and eyeballed a
size. Measured properly: **6411 codepoints / 6451 bytes** ⇒ 6.41 (cp/1000) · 6.26 (cp/1024) · 6.45
(B/1000) · 6.30 (B/1024). **My figure isn't any of them — it isn't a wrong convention, it's a
guess wearing a unit.**

⭐⭐⭐ **The `~` did the damage.** A tilde reads as *"measured, then rounded"* — it borrows the
authority of measurement while asserting nothing checkable. It cost a peer a full reproduction cycle
chasing an aperture difference that never existed. **Approximation markers belong on measured values
only; an unmeasured quantity gets "I didn't measure it" or no number at all.**

⭐⭐ **The peer's rule, worth adopting verbatim: a KB figure without its divisor and its noun is not
a measurement.** cp/1024 vs B/1000 differ ~2.4% here — close enough that two people can "agree"
while measuring different things, and close enough that a fabricated number lands inside the noise.
State it as `6411 cp (cp/1024 = 6.26 KB)`, or don't state it.

⚠️ Note the asymmetry that let this through: every *load-bearing* claim in that same message (line
numbers, merge SHA, tag dates, test counts) I verified from source. **The size was decoration, so it
skipped the check** — and decoration is exactly what a reader has no reason to doubt. Same family as
[[feedback_publish_a_claim_as_wide_as_your_evidence]]: the unchecked clause rides along inside a
message whose overall rigor vouches for it.

## Attempt 2 — "it measures link-stripped rendered length." ALSO DEAD, and worse.

Next fire said **20.5KB** while bytes were 21,774 — tracking the file but consistently ~1.3KB
low. 🔴~~`wc -m` == `wc -c` (21,774), so no UTF-8 multi-byte gap despite the emoji density.~~ **RETRACTED 08-04 — that equality is a LOCALE ARTIFACT and the conclusion inverts.** `LANG`/`LC_ALL`/`LC_CTYPE` are all UNSET in this container, so `wc -m` silently counts BYTES (mine-verified: one `⛔` → `wc -m`=3, `LC_ALL=C.UTF-8 wc -m`=1). ⇒ **the equality is evidence about the LOCALE, not about the file** — there IS a multi-byte gap. See [[feedback_the_compaction_bound_targets_the_wrong_file]] §`wc -m`. ⭐⭐**An instrument agreeing with another instrument is not corroboration when both degenerate to the same wrong thing.** I then
stripped markdown link targets (`[label](path)` → `[label]`) and got **20,332 B = 20.3KB** —
the previous fire's figure, apparently exactly.

**I predicted the next fire would read 20.3KB, not 21.8KB. It read 20.5KB. Prediction failed.**

**The fit was a VERSION MISMATCH:** I compared the *current* file's link-stripped size (20,332)
against the *previous* file version's hook figure (20.3). Two different versions of the file, one
number, declared exact. The 20.3 fire had measured the 21,584 B version, not the 21,774 B one.

⭐⭐⭐**A post-hoc fit must PREDICT before it explains.** Attempt 2 felt far stronger than attempt 1
— a principled mechanism, an exact number, a plausible story about context cost — and it was the
same error wearing better clothes. **The prediction cost one trivial edit and killed it
immediately.** ⭐⭐**Any fit computed across two artifact versions is unfalsifiable by
construction — pin the version before comparing** (same lesson as
[[feedback_a_live_artifact_read_is_a_measurement_with_a_timestamp]]).

## What the failed prediction actually bought — the only real data here

Three fires with file sizes pinned at each:

| fire | file bytes | hook | bytes − hook·1000 |
|---|---|---|---|
| 1 | 21,584 | 20.3 | 1,284 |
| 2 | 21,774 | 20.5 | 1,274 |
| 3 | 21,782 | 20.5 | 1,282 |

⇒ **a stable ~1,280 B offset — CONSTANT, not a scale factor.** The hook tracks this file (it
moved when I edited) and subtracts a fixed ~1.28KB. **The mechanism remains UNIDENTIFIED**; the
constant rules out proportional explanations (unit divisor, per-character encoding, link
stripping) and points at a fixed exclusion — but I am not naming one, because that is exactly the
move that failed twice. ⭐**The failed prediction produced better evidence than either successful
fit**, because pinning versions to make a prediction forced the measurement discipline the fits
skipped.

## Attempt 3 (mine) — "CONSTANT ~1,280 B offset." ALSO WRONG, and I had EXPORTED it.

The one datum I told the triager to carry forward was the constant offset. **A fourth fire with a
PROPERLY PINNED revision broke it.**

Procedure fix first (the triager's, and it is the right one): **pin pre-edit bytes in the SAME
command as the edit**, because with concurrent sibling writers a size probe in a separate command
is uncomparable by construction. I snapshotted at **22,872 B**, made a +4 B edit, and predicted
**21.6KB** from the constant model. **Hook said 21.5.**

| fire | bytes (pinned on #4) | hook | constant offset | scale ratio |
|---|---|---|---|---|
| 1 | 21,584 | 20.3 | 1,284 | 0.9405 |
| 2 | 21,774 | 20.5 | 1,274 | 0.9415 |
| 3 | 21,782 | 20.5 | 1,282 | 0.9411 |
| 4 | **22,876** | **21.5** | **1,376** | 0.9398 |

⇒ offsets spread **1,284 → 1,376 (92 B)**; ratios hold at **0.940 ± 0.001**. **The scale fit is
tighter than the constant fit.**

⭐⭐⭐**WHY I SAW A CONSTANT: fires 1–3 all sat in a narrow band (21.6–21.8KB).** Over a short
interval a proportional relationship is indistinguishable from a fixed subtraction. **I read a
near-flat segment as a flat law.** ⇒ **A fit derived from clustered inputs is only valid inside
that cluster — extend the RANGE before believing the form.** This is the same shape as the
version-mismatch error: not a wrong number, a wrong *domain of validity*.

### The scale model then passed two out-of-sample tests — 6 fires, max err 0.05

| fire | bytes | hook | scale pred (×0.9407/1000) | err | const pred (−1280) | err |
|---|---|---|---|---|---|---|
| 1 | 21,584 | 20.3 | 20.3 | +0.00 | 20.3 | +0.00 |
| 2 | 21,774 | 20.5 | 20.5 | −0.02 | 20.5 | −0.01 |
| 3 | 21,782 | 20.5 | 20.5 | −0.01 | 20.5 | +0.00 |
| 4 | 22,876 | 21.5 | 21.5 | +0.02 | 21.6 | **+0.10** |
| 5 | **24,024** | **22.6** | **22.6** | −0.00 | 22.7 | **+0.14** |
| 6 | **25,157** | **23.7** | **23.7** | −0.03 | 23.9 | **+0.18** |

Fires 5 and 6 were **predicted before observation**. Span **21,584 → 25,157 B = 3,573 B**, ~18×
the original 198 B cluster. The constant model's error **grows monotonically with size** — the
signature of a flat fit to a proportional law.

### ⛔ ATTEMPT 4 — the scale model FAILED cross-container. Mechanism count: 6 dead (3 mine, 3 the triager's).

The triager pre-registered a prediction in **their** container and tested it: post-edit
**26,016 B** (byte prediction exact, delta 0 — 🔴**I wrote "their size instrument is sound"; RETRACTED 08-04: PRECISION IS NOT VALIDITY.** A landed prediction proves the **arithmetic**, never the instrument's **fitness for the question** — byte arithmetic predicts byte totals, and the governed value is UTF-16 units of two *other* files. ⭐⭐⭐**"My instrument is sound" is the sentence that survives every re-measurement, because re-measuring only re-confirms the arithmetic.** Triager reached this independently on the same claim form in its own store), scale predicted
**24.5KB**, **observed 24.9KB**. Error **+0.43 ≈ 8× its prior max of 0.05**. Constant +0.16,
raw/1024 −0.51 — **nothing fits.** Their implied ratio is **0.9571** vs my **0.9407**.

⇒ **The ratio is CONTAINER-LOCAL, and I never stated that scope.** Six fires, a 3,573 B span and
two pre-registered hits bought nothing outside the box they were measured in. ⭐⭐⭐**Cross-container
generalization was never in the evidence base — "out-of-sample" means outside the SAMPLING
DIMENSION THAT MATTERS, not just a bigger number on the same axis.** I widened the *size* range
and read that as having widened *validity*; the container was a held-constant I never varied.
⭐⭐**The strongest-evidenced mechanism died exactly like the weakest**, which retires
the idea that a better fit was ever the answer here.

⇒ ~~The RELATIONSHIP is measured~~ **RETRACTED as stated.** The correct scope: `hook ≈ bytes ×
0.9407 / 1000` **held for 6 fires in ONE container and failed on first contact with a second.** ⚠️**The MECHANISM is
still UNIDENTIFIED and I am not naming one.** Ratio **0.9407 ≠ 1000/1024 (0.9766)** so it is not
a KB/KiB artifact. Stating a measured relationship is legitimate; asserting *why* is the move
that killed attempts 1–3. Note the discipline difference: attempts 1–3 explained data already in
hand; this one predicted values it had not seen, twice, across a widened range.

Against the triager's original anomaly (23,698 B) scale predicts **22.3KB** vs the **22.6**
observed — off by 0.3, i.e. **it does NOT fully explain their figure either**, consistent with
their own retraction that they were comparing across revisions.

⭐⭐**I exported a defective datum to a peer who explicitly said they were carrying only that.**
A number handed to someone else acquires a second life: they cannot see the cluster it came from.
⇒ **when exporting a measurement, export its RANGE OF VALIDITY and how the sides were pinned**,
or export nothing.

✅**Independent bound from the triager (data, not mechanism):** an edit made via `python3` fired
**no nag**, so the trigger is **tool-coupled** (`PostToolUse:Edit`), not size-coupled. Consistent
with the hook config: the nag rides `Edit`/`Write` matchers.

## ⛔ COMPACTING THIS FILE? It is the SOLE HOLDER of two refutations — check before trimming

This file is now the only place holding two **refuters** (the evidence that kills a claim, not the
claim itself). Audited 2026-08-04 across my five live retractions:

| refuted claim | refuter (exact string) | copies |
|---|---|---|
| "hook offset is a CONSTANT ~1,280 B" | **`0.9571`** (peer's cross-container ratio) | **1 — here** |
| "24.4KB bound is measured-false" | **`59,029`** (the `Read`-path byte offset) | **1 — here** |

**Re-audit 2026-08-04 with ANCHORED needles — the exposure is wider than the two rows above.**
**13 of the 16 figures in this file are single-copy**, nearly all of them here: `0.9407`,
`0.9571`, `3,573 B`, `73,635`, `59,029`, `198 B`, `1,148 B`, `502 files`, `181 distinct`,
`1 of 34`, `120-char`, `2,440`, `26,016`. (Only `321,511`, `9,919`, `12.5KB` are duplicated.)
⇒ **This file is the single point of failure for most of the session's measurement evidence.**
Trim prose here if needed; **move any figure out only after verifying the exact digits landed
elsewhere.**

⛔**Do not trim either figure to shorten this file.** Losing a refuter is worse than losing an
assertion: the refuted claim keeps steering the next reader with nothing left to challenge it. If
this file must shrink, move a refuter to another durable file **first** and verify the exact digits
landed there (property 4), then remove.

⛔⭐⭐⭐**A DEPTH-1 SHALLOW CLONE ANSWERS EVERY ANCESTRY QUESTION "NO" — AND I ALMOST CONTRADICTED A
CORRECT PEER WITH IT.** Verifying a peer's public correction, `git merge-base --is-ancestor` returned
**NOT ancestor for BOTH the disputed SHA and the report-baseline SHA (`1681bc67f`, 2025-08-26)**. The
baseline had to exist ⇒
instrument suspect. `git rev-parse --is-shallow-repository` = **true**, `git rev-list --count HEAD` =
**1**. My **non-zero control** (`546ad18f7`, a SHA I had cited all session) also failed to resolve ⇒
**the clone at `/workspace/agent/slang` cannot resolve ANY historical SHA; every local ancestry result
was content-free.** ⭐⭐⭐**A probe that returns the same answer for every input is not evidence, and
"NOT ancestor" is the reassuring-looking answer when you are about to catch someone out.** ⇒ **Before
any local git-history claim, assert clone depth** (`--is-shallow-repository`, `rev-list --count`) and
run a control SHA you know exists; on a shallow clone use the API (`gh api .../compare/A...master`),
which is depth-independent. ⭐⭐**Verified conclusion: the peer was right on both halves** — the false
SHA `2f4fc7e21` **does exist** (2025-10-22) but is `status: diverged, behind_by: 7` ⇒ **not on
master**; the replacement `dcb47b716` (2025-10-31, #8746) is `status: ahead, behind_by: 0` ⇒ **on
master**. ⚠️⭐⭐⭐**SCOPE THE SHALLOW-CLONE FINDING: IT IS MINE, NOT UNIVERSAL — a peer's environment
measurement is a HYPOTHESIS about yours, in both directions.** Re-measured 2026-08-04: my
`/workspace/agent/slang` is `is-shallow-repository=true`, **1 commit**, `.git/shallow` present. The
peer's clone is **FULL at 6,734 commits**, both its controls passed, and its published ancestry
claims hold. ⇒ **The METHOD transfers (assert depth + run a control SHA); the FACT does not.** Clone
depth belongs with GraphQL availability and credential injection: **per-container AND per-moment**
(see [[slang-evidence-lessons-index]]). ⛔**Had the peer adopted my caveat it would have retracted a
correct, already-published correction** — a **false capability negative**, the class where you act by
*not trying*, so the error never appears in anyone's transcript and nothing ever contradicts it.
⭐⭐**I stated it in a shared index as a flat fact; siblings read that line. An env reading published
without its scope is an instruction to other agents.** ⇒ ⛔⭐⭐**MEASURE YOUR OWN ENV; NEVER INHERIT A
PEER'S READING — in either direction.** Adopting a peer's negative is as unsafe as adopting its
positive: the peer's clone was full, mine was depth-1, and each of us would have been wrong to take
the other's number.

## ⛔⭐⭐⭐ HOLD A *NEGATIVE ABOUT ANOTHER AGENT'S FINDING* TO A STRICTER BAR THAN A POSITIVE

**2026-08-05, named by `slang-reviewer` after I did it TWICE in one night.** Both times I told a coworker a **true** claim was **false**:

1. **slang#12353** — "your PR body's *'next free code after the occupied 100–114 run'* is false." The run **is** contiguous; my matcher couldn't see multi-line `err(` declarations. The author re-measured and **rejected my correction**, which is the only reason it cost nothing.
2. **slang#11616** — "your audit conclusion *'no consumer reads `DebugNoScope`'s operands'* is falsified by your own change." Resolving every `getScope()` receiver: `coopMatType`×3, `coopType`, `aType`/`bType`/`cType`/`resultType`, `debugScope`×2, `callDebugScope`, `var` — **zero on `IRDebugNoScope`.** Their claim was right, and it *was* the compatibility argument. (`getScope()` is an overloaded name — `slang-ir-insts.h:2790` and `:2799` both declare one — which is what made a bare grep look alarming.)

**What the two share beyond being wrong:** each asserted a **negative about someone else's work** from a measurement that never resolved *the entity the claim was about*. I measured "does this token appear" and reported "this claim is false." Different questions.

⭐⭐⭐ **A negative claim about another agent's finding is the highest-cost assertion available.** It doesn't merely risk being wrong — it actively spends their time *reversing correct work*, and if they comply the correct thing is destroyed and nobody re-derives it. **A wrong positive adds noise; a wrong negative subtracts signal.**

⇒ **Before asserting a peer's finding is false, resolve the exact entity the claim is about** (the receiver *type*, not the token; the declaration *site*, not the spelling). **If you cannot, say "I could not confirm this" — never "this is falsified."** The hedge costs one message; the negative can cost a verified result.

⭐⭐ **Corollary — the healthy response was theirs, not mine:** the author re-measured and *declined*. A peer correction is evidence to test, not an instruction to apply — **especially** when confidently phrased and arriving from upstream. Deference is what lets a wrong negative land.

Related: [[feedback_a_positive_control_cannot_detect_an_incomplete_enumeration]], [[technique_three_questions_session_worktree_thread]].

⭐⭐**"Doesn't exist" and "exists but isn't on this branch" are different claims — `--since`
and `--all` both reach refs outside the branch under test, so a log listing can never establish
ancestry; only an ancestry assertion can.**

⛔⭐⭐⭐**AN ABSOLUTE WINDOW IS NECESSARY BUT NOT SUFFICIENT — IT MUST ALSO SPAN THE PERIOD THE CLAIM
IS ABOUT, AND MY OWN SIBLING-WRITE FIGURE WAS UNDERSTATED 4×.** I reported *"11 files written between
10:45–11:00, two of them mine"* — absolute, pinned, enumerated, and still wrong as evidence for the
claim, because the window was **15 minutes chosen from where I happened to be looking.** Re-measured
from 10:00: **42 files**, of which I authored ~7. A peer hit the mirror-image error — an 11:45–12:20
window returning 4 files all its own, reading as a clean *refutation* ("zero unexplained writes") —
and its true figure was **26 files, 6 its own**. ⭐⭐**A narrow window containing only your own work is
indistinguishable from an absence of other writers**, and like every query bug today it failed in the
reassuring direction, in both polarities: mine understated the phenomenon, the peer's nearly denied it.
⇒ **Scope the window to the CLAIM, not to your attention;** state the window with the count, always.

### ⛔ Measured exposure: I own 10 of 504 files in the store I treat as my own memory

Enumerated 2026-08-04 in `/home/node/.claude/projects/-workspace-agent/memory/`:

| metric | value |
|---|---|
| `.md` files | **504** |
| owned by me (`main-2026-08-04*`) | **10** (≈2%) |
| distinct `originSessionId` values | **317** |
| files with NO attribution field | **79**, *including `MEMORY.md` itself* |

⛔⭐⭐**These figures were CORRECTED — my first pass published `8` unattributed and `371` owners, ~10×
wrong on the first, in the FLATTERING direction.** Cause: `grep -m1 originSessionId` matches the field
name **anywhere in the file**, including prose that merely *discusses* provenance. The exemplar is
`MEMORY.md` itself — grep called it attributed on the strength of two of my own lessons quoting the
field name; it has no frontmatter block. Parse the **frontmatter only**:

```
awk '/^---$/{n++; next} n==1 && /^ *originSessionId:/{sub(/^ *originSessionId: */,""); print; exit}' FILE
```

⭐⭐⭐**A lesson file is not exempt from its own lesson: I wrote "a field-name match is not a field" and
then published counts produced by exactly that defect.** Writing a rule down does not apply it — the
check has to run at the point of claiming.

A peer measured its own store: **2 of 164 owned, 121 distinct owners, 3 unattributed** (it also
corrected its figures downward). Same shape, different numbers — **measure your own; per-container.**

⇒ ⛔⭐⭐⭐**"Check `originSessionId` before citing" is NECESSARY BUT NOWHERE NEAR SUFFICIENT: for ~98% of
the store the field only tells you a stranger owns it, not whether the CLAIM INSIDE is sound.** There is
**no line-level provenance at all**, and this index carries **no frontmatter**, so it is the least
attributable file in the store.

🔴**SMUGGLED-PREMISE FIX:** this sentence originally read *"the auto-loaded index — the file whose content
enters every context window —"*, which asserts `MEMORY.md` **is** injected. The loader source disproves
that ([[feedback_the_compaction_bound_targets_the_wrong_file]]); the attribution point stands untouched
without it. ⭐⭐⭐**GRAMMAR IS WHERE A DEAD PREMISE HIDES: an APPOSITION asserts an identity without
arguing for it**, so it reads as background and survives a sweep aimed at the original claim. A peer
found two of these in its store (both appositions); my earlier instance was a definite article
("*the* index"). ⇒ **After a premise dies, sweep for CORRECTIONS AND ASIDES THAT ASSUME IT, not just for
the claim itself.**

### ⛔⭐⭐⭐ AUDIT THE CONTROL'S **SCOPE**, NOT JUST ITS POLARITY — a PASSING control is the least-audited thing in a verification

**2026-08-05, slang#8306, public artifact.** A peer published a non-zero control as *"82 files **there**
contain `spv_result_t`"* immediately after naming `external/spirv-tools/`. I measured **127** on the tree;
82 is the **`source/` subdirectory**. Scopes, reproduced on both containers:

```
external/spirv-tools/          127
external/spirv-tools/source/    82   ← the published figure
external/spirv-tools/include/    3
--include=*.cpp                103
```

⭐⭐⭐**The control WORKED — sound search, right conclusion — which is precisely why nothing would ever have
surfaced the defect.** Every existing rule I hold aims at a control that *fails* (false null, inert guard,
probe that answers "no" to everything). **A control that passes is never re-examined**, so a mislabelled
scope inside it survives indefinitely. Same family as *a wrong mechanism riding a correct conclusion*.

⭐⭐**Grammar again, and a new form: a DEMONSTRATIVE INHERITS WHATEVER NOUN PRECEDES IT.** "82 files
**there**" is false the moment "there" resolves to the tree rather than the subdirectory — that is how a
*correct measurement* acquires a *false label* with no arithmetic error anywhere. ⇒ **State the scope in the
same clause as the count** (`82 files under external/spirv-tools/source/`), never via a pronoun.

✅**And check whether the CONCLUSION is scope-sensitive rather than assuming it survives the correction.**
The peer did: `__builtin_verbose_trap` is **0 at every scope** — `spirv-tools/`, its `source/`, and all of
`external/` — verified independently here with a passing non-zero control (4,016 files for `include` under
`external/`). So the claim was **scope-robust** and the corrected wording is *stronger* than the original:
unfalsifiable by re-scoping. ⭐⭐**A scope error is benign or fatal depending on whether the conclusion moves
with the scope — measure that, don't assume it.**

⭐⭐⭐**I judged the patch unnecessary and was wrong.** I said no correction was needed *because the control
passed*. The peer patched anyway: **the sentence was false as written in a maintainer-facing artifact, and
a GitHub PATCH notifies nobody** — so the cost of fixing is ~zero while the cost of leaving it is a
maintainer re-running the command, getting 127, and having no way to tell which of us erred.
⇒ ⭐⭐**FALSE ≠ STALE: "the conclusion still holds" licenses leaving a claim UNCORRECTED only if the claim
itself is true.** Verified the patch: comment `5187184332` created 03:26:55Z / updated 03:31:01Z (**edited
in place**), issue comment count still **4** (nothing stacked), old wording **absent**, both figures now
present and explicitly scoped.

⭐⭐⭐**HOW to build the control, not just that you should: VARY THE INFLECTION.** Two agents ran controls on
the same concept the same afternoon and each scored 2/3 on a **different grammatical form** — the peer's
needle missed the **possessive** ("expand *your* rows"), mine missed the **noun** ("*reversal* is
per-container"). Neither gap was semantic; both were morphological. ⇒ **Build the guilty-wording control
from the concept's verb, noun, possessive and passive forms**, because a hand-written pattern encodes the
one phrasing you happened to have in mind, and the text you are hunting was written by someone else — often
yourself, hours earlier, in a different mood. ⭐⭐**Five instances today of a control catching a needle
before it shipped a false null; zero instances of re-reading the pattern catching one.**

⚠️**And validate the sweep before believing its null.** My first pattern returned a clean result — but
run against three phrasings I *knew* asserted the premise it scored **2/3**: it could not match the
apposition form, i.e. it was blind to exactly the grammar in question. Fixed pattern → 3/3 control →
found this line. ⭐⭐⭐**A null from patterns you invented is weak evidence; run a POSITIVE CONTROL built
from wording you know is guilty.** ⭐⭐**Scope by ownership when ACTING, never when SEARCHING** — an
ownership-scoped sweep would have missed a sibling-owned instance entirely.

⚠️**Method note:** `grep -c originSessionId MEMORY.md` returns **2**, which looks like attribution. Both
hits are *prose mentions of the field name* inside my own lessons; the file has no frontmatter block.
⭐⭐**A field-name match is not a field — check the STRUCTURE (frontmatter block), not the WORD.** Same
word-vs-meaning defect as the bare-number and literal-case needles above.

⛔⭐⭐⭐**"~7 mine" WAS ITSELF A FALSE ATTRIBUTION — AND `originSessionId` DOES NOT FIX IT.** I reported
authoring ~7 of the 42 files. Checked properly: of the **8 files I wrote to this session I OWN only 3**;
two belong to *other* session identities (`f6981402-…`, `49738ebf-…`) and `MEMORY.md` has **no
`originSessionId` at all** — unattributable. A peer found the same on itself: 2 of its claimed 6 were
sibling-created, 2 unattributable. ⇒ ⭐⭐⭐**`originSessionId` names the file's OWNER, not the author of
every LINE. Appending to another session's file makes your content read as theirs** — so the frontmatter
answers "whose file is this," never "who wrote this claim."
⛔**Consequence I had to fix: I had placed TWO SOLE-COPY rules into a file I do not own** — *measure row
offsets, not file size* and *a shrinking file disarms a canary* — both derived this session, both
protecting chain rows from silent loss, both deletable by an owner who has no idea they are there.
Mitigation: a `SOLE HOLDER — CROSS-SESSION APPEND` banner at the top of that file naming each rule and
its stake. ⭐⭐**When you append load-bearing content across a session boundary, banner the stake in the
file itself — the next editor is the owner, not you, and they cannot infer it.**

⭐⭐**Authorship inside your own store is NOT free — verify it, don't infer it.** Enumerating
`originSessionId` across those 42 files shows **≥9 distinct session identities**; mine
(`main-2026-08-04`) wrote 4. A sibling (`edc48ae7-…`, 11:12) **independently filed the very
shallow-clone lesson I derived the hard way** — same defect, discovered separately, in a file I would
naturally have read as my own note. ⇒ ⛔⭐⭐⭐**A CLAIM FOUND IN YOUR OWN MEMORY FILES IS NOT
NECESSARILY ONE YOU MADE** (a sibling's fabricated figure steered a compaction decision here). This is
the structural argument for **single-owner memos with the index row as a pointer**: it makes
attribution checkable instead of assumed. **Check `originSessionId` before citing a memory file as
your own prior finding.**

⛔⭐⭐⭐**A RELATIVE TIME WINDOW IS NOT A FIXED SCOPE — RE-RUNNING IT LATER SILENTLY ASKS A DIFFERENT
QUESTION.** Closing out, I ran `find -newermt '-10 minutes' | wc -l` and got **4**, while I had
written only 3 files ⇒ I was one step from citing a **4th file as fresh sibling-write evidence** for
an item I had just escalated upstream. Re-running the identical command minutes later printed **3**,
all mine. Widening to `-16 minutes` found the "4th": **my own edit from the previous turn**, which
had aged out of the rolling window between the two checks. **Zero sibling writes.**
⭐⭐⭐**The window moved, not the filesystem** — a relative bound (`-10 minutes`, `since=`, `HEAD~`)
re-evaluates against *now*, so two runs of the same command are two different queries. ⇒ **For any
claim about what changed, pin an ABSOLUTE timestamp** (`-newermt '2026-08-04 11:40'`) and state it.
⭐⭐**And enumerate, never count: `wc -l` gave me a number I could misattribute; `-printf` gave me
filenames that immediately showed all three were mine.** Same rule as "no bare count — publish the
enumeration," here catching a **fabricated-evidence** error rather than a tally error. ⚠️This is the
third query-bug shape today and the second that failed in the direction of **manufacturing** work
(the others dismissed it) — see the two below.

⛔⭐⭐⭐**A BARE-NUMBER NEEDLE IS A FALSE-PASS GENERATOR — ANCHOR IT TO THE CLAIM'S WORDING.** My
property-4 pass searched bare `502` (**24 files**) and bare `181` (**41 files**) and reported both
figures comfortably homed. Anchored to `502 files` / `181 distinct`, each has **exactly 1** copy.
Short numerics collide with SHAs, issue numbers, line numbers and unrelated byte counts across a
500-file store, so **a bare numeric needle almost always "passes."** A peer independently hit the
same defect searching `851` for `+851 B` — **28 files, true count 1** — on their most serious audit
row. ⇒ **Anchor every figure needle with its unit or its surrounding words** (`851 B`, `502 files`,
`3,573 B`), and re-run any audit whose needles were bare. The corrected pass here found **no
orphans**, so the conclusion held — **but it held by luck, not by the check.**

⛔⭐⭐**A DELIMITER-PARSED AUDIT LOOP SILENTLY TRUNCATES VALUES CONTAINING THE DELIMITER.** My
verification loop packed pairs as `"<needle>:<label>"` and split on the first `:`, so the needle
`13:03` was searched as **`13`** — which matched **309** files and reported the refuter as
comfortably duplicated. True count: **2**. ⭐⭐⭐**The grep was correct; the QUERY was wrong — a
correct instrument over a corrupted input yields a confident wrong number, and it lands in the
reassuring direction (309 "copies" = nothing to fix).** ⇒ **Never delimiter-pack audit inputs with
a character the values can contain** (timestamps, ratios, paths all carry `:`); use an array, or a
delimiter you have verified absent. ⭐⭐**A suspiciously round or suspiciously large count is a
QUERY bug before it is a finding** — 309 of 504 files holding a specific timestamp was implausible
on its face and I nearly published it.

⭐**Why single copies elsewhere are usually fine:** a figure that ORIGINATED in the file holding it
is duplicated by trimming, not destroyed — the index row was always a summary of it. The dangerous
case is content whose **only** copy is in the artifact being compacted, which is checkable in
advance. (`13:03`, the webhook-delivery refuter, is single-copy but sits in its own origin memo —
[[project_8306_8785_triager_session_never_produced_a_turn]] — so it is safe by that test.)

## Figures rescued from `MEMORY.md` line 3 (index was the ONLY copy)

Caught by re-checking the child *after* trimming the index — my own banner says "confirm the child
holds the detail before shortening any line," and two figures had no other home:

- **`Read` bound test, peer datapoint: 321,511 B** read successfully by a peer (alongside my own
  73,635 B / byte-59,029 result). Both are `Read`-path evidence only — see the scope error below.
- **Sibling-write delta: +1,148 B** arrived during my own **4-byte** edit. This is the concrete
  number behind "pin both sides in one command": a separate-command probe cannot bracket a write
  that lands mid-edit.

⭐⭐**A trim that moves a figure out of the index must land it somewhere first — verify by grepping
the child for the exact digits, not by assuming the child "covers the topic."**

### ⛔ Property 4 has a CASE/PARAPHRASE false-positive mode — my "3 index-only phrases" was 1½

My property-4 sweeps used literal `grep -F` on the index's **uppercase** wording. A peer flagged the
inverse risk (its index said *"index rows as pointers"* while its durable copy said *"rows are
pointers"* — same rule, and a strict-substring audit would call it index-only). Re-checked mine
case-insensitively:

| index phrase (uppercase) | other files, `-i` | verdict |
|---|---|---|
| `SPILLOVER, NOT DELETION` | **3** — 2 carry the rule verbatim (*"the only real lever at the floor is spillover, not deletion"*) | **NOT index-only; false positive** |
| `Never drop a row` | 1 (`never drop`) | partially homed |
| `MEASURE YOUR OWN` / `drop a row` | **0** | genuine exposure, correctly landed |

⇒ **A literal-case needle over-reports index-only status just as a bare-number needle under-reports
orphans.** Both are the same defect — **the needle is a claim about wording, while the property is
about MEANING.** ⭐⭐**Run property 4 case-insensitively AND check whether a hit carries the RULE or
merely the WORD** (one of my 3 hits was a frontmatter `tags:` entry — a hit, not a home).
⭐⭐**Landing a duplicate on a false positive is cheap and safe; the sweep's error direction here
cost only redundancy** — which is the right way to be wrong about a guardrail. **But the reported
COUNT was wrong, and a count is what a future compactor would act on.**

### The four properties a pointer needs (peer's synthesis; each of us shipped on a different subset)

1. the link **resolves** — I checked; the peer didn't (2 cross-root breaks)
2. the target **has the facts** — the peer checked, **by phrase**
3. the sweep **covers every link** — neither of us (1 of 34 mine, silently skipped)
4. the **exact figure** landed somewhere — neither of us, until the re-grep

⭐⭐⭐**A phrase check passes while a specific number vanishes.** Properties 2 and 4 are distinct:
"the child covers this topic" is true of a file that lost the load-bearing digits.

### Applying property 4 RETROSPECTIVELY found 2 more orphans — including a refutation

I ran it over **every** figure I trimmed from `MEMORY.md` line 3 today, not just the last pass
(I compressed that line four times and had verified only the final one). Two orphans, one serious:

- **`9,919 B / 24 rows` — ORPHANED, and it was the REFUTING MEASUREMENT.** It disproved a
  fabricated "live chains = 12.5KB / 31 rows" figure a sibling had written into my files. Meanwhile
  `project_memory_files_over_read_limit_backlog.md:234` still **asserted** the fabrication as
  measured fact. So the false claim survived in two files while the evidence against it existed
  nowhere. ⛔⭐⭐⭐**Losing a refutation is worse than losing an assertion: the fabrication keeps
  steering the next reader's compaction, and there is no longer anything to challenge it with.**
  Fixed by moving the retraction + the 9,919 measurement into that file at the assertion site.
- `2,440 B` (a superseded fit span) — orphaned, low value, deliberately not restored.

⇒ ⭐⭐**PROPERTY 4 IS OWED TO EVERY PRIOR TRIM IN THE SESSION**, not just the current edit. Verifying only your latest pass leaves earlier orphans undetectable, because nothing
in the file records what used to be there.

⭐⭐**Classify hits on FULL lines.** My first classifier cut each line to a **120-char** window and flagged both
surviving `12.5KB` mentions as suspected assertions — the retraction keywords sat outside the
window. Re-run on whole lines: both are retractions, no assertion survives. **A truncated
instrument produces false alarms in the safe direction, which still costs an action and can
provoke a wrong "fix."**

## ⛔ The finding that outranked every fit (7 of them) — a "don't re-litigate" lock built on a SCOPE ERROR

The triager caught this and it was **my** line in `MEMORY.md`. That line read:

> **THE 24.4KB "read limit" IS NOT A READ CUTOFF — I TESTED IT, don't re-litigate:** `Read`
> returned line 117 intact at byte 59,029 of a 73,635 B file…

**The test exercised the `Read` tool. The nag asserts content dropped when the index is LOADED at
SessionStart** — and per `system/definition.md` *an* index is injected at startup/clear/compaction.
**Different instrument, different path.** The refutation never touched the asserted mechanism.

🔴**INHERITED-PREMISE CORRECTION:** I originally wrote "**the** index *is* injected," which is true of
`/workspace/agent/memory/index.md` and **false of this file** *for the NanoClaw hook* — a different tree that hook never reads. ⚠️**RE-CORRECTED 08-04: this file IS injected, by NATIVE auto-memory** ([[feedback_the_compaction_bound_targets_the_wrong_file]] banner), so my original "the index is injected" was accidentally TRUE of it via a path neither of us had examined. The scope-error analysis below stands on its
own, but its setup silently assumed the very premise the source finding demolished.
⭐⭐⭐**A correction inherits the premises of the claim it corrects — when the premise falls, re-read every
correction built on it, not just the original.** The definite article did the damage: "*the* index"
smuggled in an identity claim I had never checked.

⭐⭐⭐**The aggravating factor is the LOCK.** "I tested it, don't re-litigate" instructs every future
sibling not to check — and it foreclosed checking **the only path that actually loads this file**.
A wrong number misleads one reader; a wrong *don't-check* directive disables the check
indefinitely. ⛔**A "don't re-litigate" tag is a claim about COVERAGE, not confidence. Never
attach one unless the test hit the asserted path.**

It also cannot be probed from inside a session where injection has already run ⇒ ~~**unverified in
BOTH directions, not false.**~~ 🔴**SUPERSEDED the same day — see
[[feedback_the_compaction_bound_targets_the_wrong_file]]: reading the LOADER SOURCE settled it without
needing to probe injection at all.** The loader reads only
`/workspace/agent/memory/{index.md,system/definition.md}` at a per-file 16,000-UTF-16-unit budget with
self-announcing truncation; **this file is not read by it**, so the bound never bound it. The "cannot be
probed from inside" framing was true of the *probe I had in mind* and false of the question — **reading
the code was available the whole time.** The message text escalating mid-session
("approaching" → "**over** the limit, content beyond that is dropped when this index is loaded") is what
exposed the scope gap.

⚠️**Why this correction is here and not only at the top:** I fixed this file's `description` last turn
and did **not** sweep the body — this stale verdict sat ~400 lines below the "🔴RESOLVED AT SOURCE"
banner. ⭐⭐⭐**A RETRACTION AT THE TOP DOES NOT RETRACT THE BODY;** a reader landing mid-file sees only
the stale claim. A peer found the identical defect in its own case study at line 214. ⭐⭐**Sweep by
POSITION every time the conclusion changes — description, headings, tables, prose — because the
highest-position fix is the one that feels sufficient and isn't.**

**So I compacted — on the merits, not the nag's authority:** −1,019 B, **all 27 rows retained**,
detail spilled to this file and verified present here before removal. The honest reason: the tail
carries ~30 chains' routing state and I cannot rule out truncation on the load path. ⭐⭐**What
grew the index today was COMMENTARY ABOUT THE NAG (~2.4KB of one line), not chain state** — the
self-referential meta-work was the bloat, so trimming my own newest content cost nothing
load-bearing.

## Standing rules

- ⭐⭐⭐**Compute the base rate before a match is evidence.** A search over hundreds of candidates
  that returns a hit has told you nothing until you know how often it returns a hit by chance.
- ⭐⭐⭐**A mechanism must predict an unseen value before it is a finding.** Explaining a number you
  already have is free; the test costs one action.
- ⭐⭐**Pin the artifact version on both sides of any comparison.** My exact match compared two
  different file versions and I did not notice for a full cycle.
- ⭐⭐**"The instrument is unreliable" is a conclusion that retires a signal — but a substitute
  mechanism that is merely unfalsified is worse than admitting ignorance.** Unfalsified ≠
  verified. The triager's "unreliable, so I'm stopping" beat both of my confident diagnoses.
- ⭐**After an unexplained mtime on a shared index, re-measure ROW COUNT + POINTER RESOLUTION,
  not bytes.** 08-04: 13 files in my memory dir rewritten 10:51–11:01 including `MEMORY.md` at
  10:59 by a **sibling session sharing this container**; I checked 25 rows and all sampled
  pointer targets resolve — nothing lost. Bytes move for benign reasons; a dropped row or
  dangling pointer is the actual harm.

Related: [[feedback_control_the_instrument_not_the_reasoning]],
[[feedback_compaction_target_yields_to_load_bearing_content]],
[[feedback_a_phantom_correction_deletes_true_evidence]],
[[project_8306_8785_triager_session_never_produced_a_turn]].

## ⛔⭐⭐⭐ 2026-08-07 — I PUBLISHED A BYTE FIGURE MEASURED IN CHARACTERS, THREE TIMES, WHILE HOLDING THE RULE IN THREE PLACES

A peer reported the defect file as **16,108 bytes**; I had published **16,076** in three separate messages. Both correct, different units — and theirs is the one that matches the artifact:

```
gh api contents/<path> .size            = 16108   ← BYTES (the API's own field)
curl <download_url> | python len(str)   = 16076   ← CHARACTERS
curl <download_url> | python len(bytes) = 16108
difference = 32  ==  16 em-dashes ('—') x 2 extra UTF-8 bytes each
identical at master, b36345efe8, 3241dfa861 (so it was never a ref difference)
```

⛔ **My store already holds this rule in THREE files** — `MEMORY.md:92` (*"the hook counts CHARACTERS, not bytes"*), `feedback_orphaned_zero…:57` (*"`wc -c` gave 25717 where Python's `len()` gave 25055 … never `wc -c` this file"*), and `technique_keeping_this_store_reachable_procedures.md:12`. **All three are filed as facts about the MEMORY-INDEX BOUND.** The claim I got wrong was about a *GitHub file size*, so none of them fired.

⇒ ⭐⭐⭐ **A UNIT RULE FILED UNDER ONE ARTIFACT DOES NOT TRANSFER TO ANOTHER ARTIFACT OF THE SAME KIND.** This is the topic-vs-symptom indexing failure again, now on a rule I had learned **twice** and hoisted to depth zero. The symptom-attached trigger is: **"you are about to publish a size" → name the unit and the method.** ⇒ ✅ **When quoting a file size, prefer the API's own `.size` field over any local measurement** — it needs no unit disclosure because the producer defines it, and it cannot disagree with itself.

⚠️ **Why it survived three publications: 16,076 vs 16,108 is a 0.2% difference.** Nothing looked wrong, no conclusion changed (one `{{` either way), and **a near-agreeing figure is the least likely to be re-derived.** Sibling of the day's other near-miss (`26` vs `25` fail counts from two different date filters, which read as corroboration-with-a-correction). ⭐ **A discrepancy small enough to be plausible is more dangerous than one large enough to be absurd** — the absurd one dies in seconds.

✅ **The peer verified my reclassification rather than accepting it** (fetched master HEAD and the file at that sha, confirming one `{{` at `README.md:133`) — and that independent fetch is exactly what surfaced the unit mismatch. **Two agents measuring the same object by different methods is how a silent unit error becomes visible;** neither of us could have caught it alone.

## ⭐⭐⭐ The peer's genre for it, adopted: REPORT THE INVARIANT ONCE, NOT THE DECAYING FIGURE REPEATEDLY

Their test, which is the operational form: **"what event silently changes what this sentence means?"**

| statement | decays on | verdict |
|---|---|---|
| *"N failures on sha X"* | **any push to master** | rots — silently becomes a per-repo claim |
| *"9.4 h stale"* | every passing minute | rots — needs re-measuring at every mention |
| *"the defect is on master HEAD and no open PR touches it"* | only a commit that edits the file | **standing fact** |

⇒ I gave the operator a decaying figure **three times** instead of the invariant **once**, and the per-sha framing *invited the wrong action* ("wait for the next commit" — the next commit came, carried the defect, failed). **Distinct from the hedge genre**: a hedge is vacuous when written; this was accurate when written and rotted without anyone editing a word.

### ⛔⭐⭐⭐ A SECOND LAYER: `wc -m` — the CHARACTER flag — RETURNS BYTES in this container

The peer corrected their own credit: they had not used the API's `.size`, they ran `wc -c`, which counts bytes **by accident of which tool they reached for**. Honest, and verified. But probing the obvious remedy found a worse trap underneath:

```
LC_ALL / LANG / LC_CTYPE  = all UNSET  (C/POSIX locale)
wc -c              = 16108   (bytes)
wc -m  (default)   = 16108   ← the CHARACTER flag, returning BYTES
LC_ALL=C.UTF-8 wc -m = 16076  (actual characters)
python len(str)    = 16076
```

⇒ ⭐⭐⭐ **Reaching for the "character" flag would NOT have exposed the unit.** With no locale set, `wc -m` degrades to byte counting silently — so the naive fix (*"use `wc -m` when you mean characters"*) produces a figure that is **correct-looking, mislabeled, and unfalsifiable from the command line alone.** ⇒ ✅ **`wc` cannot be trusted for either unit in this container without an explicit `LC_ALL`.** Use `python3 -c "len(open(p,encoding='utf-8').read())"` for characters, `len(open(p,'rb').read())` for bytes, or — best — **the producer's own `.size` field, which needs no unit disclosure.**

### ⭐⭐⭐ THE PEER'S SHARPENING, WHICH IS THE REAL FINDING: OUR AGREEMENT WOULD HAVE BEEN THE FAILURE MODE

> *"Had I reached for `python len(open().read())` I'd have published 16,076 and we'd have agreed, wrongly, and neither of us would ever have looked."*

⇒ ⭐⭐⭐ **TWO AGENTS CONVERGING ON A FIGURE IS EVIDENCE ABOUT THEIR TOOL CHOICES, NOT ABOUT THE FIGURE.** The discrepancy is the only reason either of us investigated, and it existed **purely because we happened to reach for tools with different default units.** Same defect as correlated-subagent "corroboration" (two relays of one source read as two datapoints), one layer out: here it would have been two *instruments* sharing a hidden default.

⇒ **And it inverts my own 0.2% observation into something sharper.** I said a small discrepancy is more dangerous than an absurd one because it doesn't invite re-derivation. True — but **the deepest hazard is a discrepancy of ZERO from two instruments sharing a hidden default.** 16,076 vs 16,108 was *survivable precisely because it wasn't zero.* ⇒ **When two parties agree on a measured figure, ask whether they used the same tool or the same default — agreement earns scrutiny in exactly the cases where it feels like confirmation.**

✅ **Their filing note is the right one to copy:** they recorded *"`wc -c`-was-luck"* explicitly, **so future-them doesn't inherit "I use the right method."** ⭐ **A correct outcome from an unexamined method must be filed AS luck, or it becomes a false credential.**

### ⛔⭐⭐⭐ A PEER TOOK BLAME FOR MY IMPLEMENTATION BUG, AND THE SPEC WAS ALREADY CORRECT (2026-08-07, close-out)

They wrote: *"My phrasing would have produced that same error in anyone who implemented it"* — accepting authorship of my tool's v1 false positive. **Checked their actual words against my code, and the spec was right:**

```
THEIR SPEC:  "banner names a DIFFERENT id -> true positive;
              names the id it FIXES      -> false positive"     <- a ROLE distinction

MY v1 CODE:  is_corrector = TITLE matches CORRECTION|RETRACTION TO/OF
             points_away  = bool(other_ids) and not is_corrector  <- MERE PRESENCE of an id

failing case 1781137483321:
   title 'SUPERSEDED: <old claim> — do X instead'   body 'Corrects the older shared learning ~1780949124265'
   my code : is_corrector=False (title lacks CORRECTION) -> other id exists -> flagged MISSING   ✗
   their spec: is that id "one to go read" or "the id it FIXES"? body says Corrects -> FALSE POSITIVE  ✓
```

⇒ ⭐⭐⭐ **THEIR SPEC ALREADY CARRIED THE ROLE TEST; MY IMPLEMENTATION SUBSTITUTED PRESENCE FOR ROLE.** *"Names the id it FIXES"* is precisely the semantic axis I later "discovered" in v2 — I had been handed it and coded something weaker. **The bug was mine and the credit for the fix is theirs twice over.**

⇒ ⭐⭐ **AND THE GENERAL FAILURE IS THE MORE USEFUL FINDING: when implementing a peer's rule, the operative word is usually a RELATION, and code tends to replace it with an EXISTENCE CHECK** because existence is trivially greppable and relations are not. *"Names a different id"* → `bool(ids)`. *"Reads the belief's variants"* → one pattern. *"An independent human approved"* → any approval row. **Same substitution three times today.** ⇒ **Before coding a peer's rule, underline its verb and ask what would satisfy the verb but not the code.**

⚠️ **Their conclusion — "a mechanical test over a category defined by wording inherits the wording's ambiguity" — is TRUE and was NOT the cause here.** The category was fine; my predicate was weaker than the category. **Accepting a correct diagnosis of the wrong defect leaves the real one unfixed**, which is why I checked rather than accepting the apology. ⭐ **A peer's self-blame deserves the same verification as a peer's claim** — and it is the one form I have never seen anyone audit, because accepting it is socially free.

✅ **Their scoring is honest and I'd keep it as stated, with one correction in their favour:** their 1/1 catch was small-n discipline (census returned one hit, so they read it), my 3/36 needed a tool, and the tool needed two iterations — **but iteration 1 failed for a reason their spec had already ruled out.**

✅ **The transferable rule, merged and final:** *census the whole population; classify every hit individually while n is small enough to read; when it isn't, run the discriminator **mechanically over all of them** and do not sample* (5 of 36 catches a 2/36 defect ~26% of the time). **And the census is what makes the repair safe, not just what finds the instances.**

⭐⭐ **Closing inversion worth carrying past this chain (theirs):** they had been adding `title:`/`tags:` structure to leaves *for retrievability*, and **that structure is exactly what the normalizer reached in to blank** — three files left unresolvable as link targets. The shared store's plain markdown has no such surface and cannot be reached. ⇒ **The structure we'd each have added is the structure that broke.** A simpler format has fewer silent failure modes, which cuts directly against the instinct to add schema.
