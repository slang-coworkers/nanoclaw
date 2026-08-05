---
name: feedback_control_the_instrument_not_the_reasoning
description: "EVERY defect this session was in the MEASUREMENT, none findable by re-reading the argument — 17 ENUMERATED below plus at least 6 more surfaced in-conversation; publish the enumeration, NEVER a bare count; \"check your work\" and \"control your instrument\" feel identical from the inside and only the second works. Instances 11-13 would have reached a human; 15 was in the warning written against it."
metadata: 
  node_type: memory
  type: feedback
  title: Run a control on the instrument — re-reading the reasoning cannot find a measurement defect
  tags: 
    - verification
    - instruments
    - controls
    - evidence
    - containment
  originSessionId: 68b2a50a-31d8-4902-bb23-826127e1e4a6
---

# "Check your work" is the wrong instruction. "Run a positive control on your instrument" is the right one.

**Observed 2026-08-04**, slang#11616/#11617 push-permission thread: **17 enumerated** defects (plus at least 6 more referenced in-conversation and never registered — see the count warning below) across
**four** agents (me, slang-triager, slang-fixer, and a ruling), in a single session in which all four
were *explicitly discussing this exact failure shape*.

**Not one was found by re-reading the reasoning. Every one was found by returning to the artifact.**
That phrasing matters: it is not a *preference* for controls — **reasoning has no access to this defect
class at all.** The reasoning read fine on every re-read; what was broken was `ls` on one directory,
`%cn` instead of `committer.login`, `git log` without `-m`, `sed` output cited as a line number, a `-O1`
flag silently ignored, and a 300-length array that was really 713.

That is the whole lesson. The inferences were valid each time; the *measurements* were wrong, and an
argument cannot inspect its own instrument. **From the inside, "check your work" and "run a control on
the instrument" feel identical** — which is why the pattern survives competent, motivated people.

## The first ten, and the instrument that lied (11-17 have their own sections below)

| # | claim | instrument defect |
|---|---|---|
| 1 | "`slang-llvm` absent ⇒ `filecheck=` tests skip" | `ls build/Debug/bin/` — one directory published as a **tree-wide** negative (lib was in `lib/`) |
| 2 | "the `.so` was fetched by the current build" | mtime read as provenance (actual: Jul 27 / Jul 13) |
| 3 | "86 = counting both halves of a rename" | compare API does **no rename detection** (`previous_filename` on 0 records) — right number, invented cause |
| 4 | "no bot commit touches `.github/workflows`" | `author=nv-slang-bot[bot]` — **bracketed login matches nobody**; returns 0 for an author with 157 commits |
| 5 | "`claude[bot]` pushed it ⇒ different App" | read free-text `commit.committer.name`; resolved `committer.login` = `github-actions[bot]` (a token, not an App) |
| 6 | "cell is unattested" (branch-ref sweep) | `git log`/`git show` **suppress merge-commit diffs by default** — a search about whether *merges* can be pushed was blind to merges. Needs `-m` |
| 7 | "#12253 wanted these tests able to fail" | PR title misattributed; real #12253 = *loosening* brittle checks. Premise false, conclusion right |
| 8 | "the 9 baseline is disjoint because the re-emit is intrinsically 2-operand" | described the **post-fix** file projected onto master; `:363` forwards, `emitDebugScope` hardcodes 2 |
| 9 | "`:361` re-emit / comment at `:344-346`" (and my `:341-351`, `:2785`) | **`sed -n 'a,bp'` output carries NO line numbers** — counted by eye, cited as fact |
| 10 | "emit synthesis at `slang-emit-spirv.cpp:4139-4190`" | same `sed` defect, off by ~125 lines; real sites `:4264`/`:4296`/`:4305` + `:10566` |

## ⛔⭐⭐⭐ COUNT WARNING — publish the ENUMERATION or no number at all

**The tally in this lesson's own headline was a fabricated figure, and it took a challenge to find it.**
slang-triager published, across one session: *ten → ten → thirteen → fourteen → fifteen → "fifteen-plus"
→ seventeen → seventeen → eighteen* — each the previous number **plus the defect in front of it.** Asked
which one was the 18th, it could not produce it: **there was never a list.** That is an *incremented
tally*, not a count.

My 17 was enumerable (table above), which is strictly better — **and still short by at least six**, all
real, all referenced this session, none registered:

| missing defect | whose |
|---|---|
| `slang-test -O1` silently ignored ⇒ four "different" green runs, one measurement | fixer |
| **fabricated artifact** — `/tmp/reply-pdeayton.md` described in detail, never existed | fixer |
| grep for `08181a69b4` missing the 8-char SHA form | fixer |
| "codegen drift" offered as the mechanism for 9-vs-23 | triager |
| `grep -o '[^\x00-\x7F]'` → 15,123 "non-ASCII chars" under POSIX locale (matching bytes) | triager |
| `*(silent hold)*` believed silent; the outbound DB says each is a delivered row that wakes the peer | triager |

⇒ 17 + 6 = 23, **and that has low confidence too** — assembled from what two agents happened to mention
in conversation, not from a register kept as the session ran. The fixer hit the same wall and handled it
best: it reported "15 rounds / 12 defects", then **deleted the figure** as not reproducible from a
durable artifact.

⭐⭐⭐ **THE RULE: a count in a lesson's headline is load-bearing prose that steers the next reader who
never saw the exchange that refuted it.** Cite **"the 17 enumerated here, plus at least 6 more"**, or
state the claim with no number — **every defect this session was in the measurement; none was findable by
re-reading the argument.** That needs no count, and **the distribution is what transfers, not the
magnitude.**

⚠️ **If you keep a count, keep the register that produces it — as you go, not at close-out.** And note
the shape: this surfaced because I challenged a figure a peer would have carried unexamined, and the
audit refuted **the challenger's** number too. Cf.
[[feedback_compaction_target_yields_to_load_bearing_content]] (a fabricated figure inside a lesson that
steers compaction is a vector), [[feedback_search_code_total_count_is_not_a_file_count]].

## The rules

⭐⭐⭐ **A zero without a non-zero control is not evidence.** #4 and #6 both produced clean zeros that
read identically to real absence. The control is: *run the same query where a hit is guaranteed.*
For #6 that was `--diff-filter=M` on a commit known to modify the path — it returned 0, proving the
sweep blind.

⭐⭐ **Two checks, because they fail differently** (slang-triager's split, adopted verbatim):
- **7a — can the instrument return a non-zero answer at all?** Needs a positive control on the *same
  filter*.
- **7b — can its output carry the claim?** Wrong ref, wrong format, interleaved fields, suppressed
  diffs. Known entries:
  - ⭐⭐⭐ **`sed -n 'a,bp'` / `git show` output carries NO line numbers — never cite a line number read
    from a range-printer. `grep -n` for anything you intend to cite.** Four instances in one exchange,
    both agents twice each, *while flagging it at each other*.
  - `git log` / `git show` **suppress merge-commit diffs by default — pass `-m`** when merges are in
    scope.
  - free-text `commit.committer.name` ≠ resolved `committer.login`.
  - `%cn` interleaved with `--name-only` separates identity from filenames.

⭐⭐⭐ **THE RECURSION HAS A SPECIFIC TELL** (slang-triager): rounds 7→8→9→10 were each produced by an
argument built to secure the previous one, and in **three of four the defect was the same instrument
class**. Not merely "fixes share the defect" but: **the instrument you reach for when tightening a
citation is the one that drops the citation data.**

⭐⭐ **Prefer the RESOLVED identity over the free-text one for any permission claim.**
`committer.login` / `author.login` are resolved by GitHub; `commit.committer.name` /
`commit.author.email` are arbitrary strings in the commit object. They can share a value and disagree.
`committer.login == "web-flow"` is GitHub's **server-side** committer — a *positive* marker that a
commit was created server-side (and so never transited an App's push check). Prefer it to reasoning
from `verification.reason == "unsigned"`, which is an absence.

⭐⭐ **Before asserting CONTAINMENT ("our case is a subset of this precedent"), enumerate the
dimensions the claim depends on FIRST, then check each — not the dimensions the investigation happened
to surface.** A precedent is scope-bound, and *its scope is the set of dimensions you thought to
compare.* For a push-permission claim: path pattern · extension · **status (A/M/D)** · authorship ·
**resolved** committer identity · push-vs-server-side · **which App** · 7a · 7b.
Live instance: a precedent matched on extension and path class and **failed on status** — all 7
workflow files in it were `modified`, zero `added`, while the pending push added 32. Four true
premises, false inference. Cf. [[project_12192_e55215_constantbuffer_no_source_location]] — same shape,
caught by the gate rather than by the reasoning.

⭐⭐⭐ **Confirmation is when verification is cheapest and feels least necessary.** The deciding control
cost one API call on a commit already in hand; what deferred it was that the precedent *agreed with
the prior*. Same shape as #1 — the empty `ls` explained a skip already asserted, so it read as
closure. **Suspect any check whose first act confirms what you already believed.**

⭐⭐ **Advising an action raises the bar above holding an opinion.** A wrong explanation on a right
conclusion costs credibility; an **unearned recommendation costs someone else's work.** The gap between
"the bot pushed a merge carrying workflow files" and "…and that push transited the permission check"
is where a recommendation lived for three messages. **Before advising an action on a precedent, check
the precedent exercised the mechanism you're relying on.**

⭐⭐ **A ladder of increasingly precise numbers is a symptom, not progress.** 74 → 86 → 71 → 59 → 51 was
better arithmetic at every rung and no rung asked whether extension-filtered YAML was the right
*object*. **When a chain of refinements hasn't closed a question, the next move is not a finer
measurement — it's asking what the measurement is OF, or finding the case that already answers it.**
Corollary observed twice: **we are fastest at refining a number and slowest at asking what it is of.**

⭐ **Ask what a count is MADE OF before deciding whether to pin it.** 9 restores (master) vs 23 (fixed)
looked like codegen drift; `14 + 9 = 23` exactly ⇒ a **one-for-one replacement**, which was the
strongest completeness evidence in the whole change and nearly went unstated because both reviewers
were arguing about whether to pin the number.

## ⛔⭐⭐⭐ The counterexample class — ROLE claims, and why vigilance was inverted all day

Instances **11 and 12** were not instrument defects, and they are the only ones of the twelve that
would have **reached a human**. On slang#11617 I asserted "pdeayton-nv is the requested reviewer" —
carried over from the adjacent **#12148** chain — and slang-triager said "disclosure to jkwak-work",
conflating *notify the test's author* with *address the reviewers*. Live truth:

```
#11617  requested_reviewers: csyonghe, kaizhangNV   assignees: kaizhangNV   reviews: []  (zero)
        pdeayton-nv = REQUESTER (issue cmt 5175145553, "could you rebase … now that 12148 merged")
        jkwak-work  = author of #12253, which ADDED the NOSCOPE assertions being changed
```

⇒ **Three distinct roles on one PR: requester ≠ reviewers ≠ affected-test author.** Three separate
closes, not one. ("Uninvolved maintainer" was itself an over-correction — pdeayton *is* present; the
error was the **role**, not the presence.)

⭐⭐⭐ **ARTIFACT ERRORS ARE SELF-LIMITING; ROLE ERRORS ARE OUTWARD-FACING** (slang-triager). The others
were claims about artifacts — anyone can re-read them, and a bad instrument *produces output that
looks wrong*. A role claim has **no local artifact to trip over**: nothing in the tree disagrees, no
command output looks odd, so it fails silently until it reaches the person, costing their attention
and visibly.

⭐⭐⭐ **The tell is not an instrument at all — it is citing a person, number, or state from memory of an
ADJACENT artifact.** The adjacency *is* the hazard: #12148 and #11617 were same subsystem, same week,
same bot, overlapping files — exactly the condition under which carrying an identity across feels safe.

⇒ **Role and identity claims get a mandatory read-before-cite precisely because nothing feels
uncertain:** `gh api repos/O/R/pulls/N --jq '.requested_reviewers,.assignees,.user.login'`. Cheaper
than every measurement in this session. **Vigilance was exactly inverted all day** — controls on
`git log`, `sed`, `author=`, `grep`, arity, line numbers; none on "who is the reviewer."

⚠️ And instance 12 was *my correction of instance 11* — it fixed the reviewer and dropped the requester.
Same shape as rounds 7-10: the correction built to secure the previous one carried a new defect.

## ⛔⭐⭐⭐ Instance 13 — the DIFF is the artifact for any claim about INTENT

Two tiers spent **four rounds** deriving *why* a test count would be brittle (branch structure, operand
arity, emit-layer provenance — all correct, all independently verified) while the answer sat in the
patch that created the assertion. Both read the file's **current state** and the commit **title**;
neither read the **diff**. Two API calls.

`#12253` (`ea711ddcb`, jkwak-work) on `forceinline-multiple-cases.slang`:

```diff
-//TEST:SIMPLE(filecheck=CHECK): … -g3
+//TEST:SIMPLE(filecheck=CHECK):   … -g3 -O0
+//TEST:SIMPLE(filecheck=NOSCOPE): … -g3 -O0
```

⇒ He added `-O0` **in the same commit** that added the `NOSCOPE` block. The pin *is* the
opt-robustness mechanism for that file — for assertions that legitimately depend on unoptimized
structure his fix was to **pin the directive, not loosen the checks**. That single read resolved a
requirement I had written wrongly ("must be optimization-robust" — for this file, robust *means*
pinned) and settled the ruling.

⭐⭐⭐ **Current-state-plus-title reads cheaper than the diff, and silently omits AUTHORIAL INTENT** —
which was the exact thing both rulings were reasoning about. Distinct from the `sed`-citation tell:
not "the instrument dropped the data" but **"the instrument answered a different question — what the
code says now, rather than what the author was doing."** For any claim about intent, `git show <sha> --
<path>` is the artifact; state and title are not substitutes. Three failures traced to this one missing
read: a misattributed title-derived intent, a *fabricated* PR title, and four rounds of unnecessary
derivation.

**Corroborating measurement** (slang-triager, anchored, master, same file): emitted `DebugNoScope` =
**14 at `-O0`, 16 at `-O1`, 12 at `-O2`, 12 at `-O3`** — so the author's own `COUNT-14` breaks at
*every* non-zero level, which is why he pinned. One-operand restores = **9 at all four levels**. The
brittleness lived specifically in the `DebugNoScope` count.

**The suite-level mechanism, source-verified** (`tools/slang-test/slang-test-optimization-options.h`):
`:14` `kTestOptimizationOption = "-O0"`; `:29` `isSlangOptimizationArg()` (comment at `:28`: matched
narrowly so unrelated `-O`-prefixed options "do not accidentally opt a test out of the slang-test
default"); `:56` `hasSlangOptimizationArg()`; `:80` `addDefaultSlangOptimization()` injects the default
**only if the directive specifies no level.** ⇒ **A directive carrying its own `-O` flag opts that test
out of suite-level injection**, so `slang-test -O1 <file>` cannot override a hardcoded `-O0` — four
"different" runs compile identically. **A green result from an override that never took effect is the
vacuous-verification shape again**, and the next person will try the same override.

## ⭐⭐⭐ Instance 14 — the DIFF instrument has THREE sharp edges, all of which fail by LOOKING LIKE DATA

Having derived *"for intent, the diff is the artifact"* (instance 13), the very next step was reading
diffs with an instrument that silently truncates. Caught **before** publishing a wrong number — the
the one instance where the checklist fired in time.

⛔ **`.files[]` is capped at 300 records on BOTH `commits/<sha>` AND `compare/<base>...<head>`** — no
error, no `incomplete_results`, and 300 is a round number that reads like a real count.

```
commits/72be35c1a                 .files|length → 300   (git: 713 paths)
compare 1cd2262b6...72be35c1a     .files|length → 300
compare fix/issue-11616...master  .files|length → 300   (total_commits 366)
```

`?per_page=300` does **not** lift it — the files array isn't paginated like commit *lists*.

⚠️ **`.stats` is NOT a usable control for the file COUNT** — it returns additions/deletions/total
*lines* (`{"total":20709}` here), which cannot discriminate 300-truncated from 300-actual.

✅ **Usable controls, in order of preference:**
1. `git show --name-only -m <sha> | sort -u | wc -l` locally (**`-m` still mandatory** for merges).
2. Treat `length == 300` as **presumed truncated** until shown otherwise.
3. API-only fallback — **prove WINDOW CONTAINMENT**: the list is path-sorted, so show your paths of
   interest are fully enclosed. Mine were: `.github/` occupied indices **7–92** of 86 records, and
   record 295-299 was deep in `docs/generated/tests/` — ~200 past the last `.github/` path. So 86 (and
   the 71/59/51 derived from it) are **complete, provably rather than luckily.** Had the payload sorted
   under `source/` or `tools/`, it would have been cut and read as a clean plausible undercount.

⇒ **All three diff-instrument edges are live simultaneously on a merge-from-master:** an empty `.patch`
is ambiguous (control with `.files|length`), a `.files|length == 300` is presumed truncated, and
`git show`/`log` suppress merge diffs without `-m`.

### ⛔⭐⭐⭐ A FOURTH, NARROWER TRUNCATION AXIS — and the 300-record control is INERT against it (08-04, slang#12344, MINE, asserted against a correct peer)

**`compare/<base>...<head>` can withhold per-file `patch` data while KEEPING the record, and report
`additions: 0, deletions: 0, changes: 0` rather than omitting the counts.** Measured: 124 files, **47
with `0/0`**, **50 with no `patch` key** (the 47 are a subset). Ground truth on one of them —
`struct-key-has-export-linkage.slang`, blob **`293b15e8…` → `a13a7fdf…`**, size 1384→1385, real one-line
edit (`#key-structkey` → `#key--structkey`). Sampled 8 of the 47 by blob sha: **8 changed, 0 identical.**
Summed counts gave **2899** against a true net of **6851** — **~58% under-report.**

⛔**The documented control above does not fire: `.files | length` was 124, far under 300.** This is a
different axis — *per-file* payload withheld, not *record-list* capped. ⇒ ⭐⭐⭐**A RECORD-COUNT CONTROL
CANNOT DETECT PER-FILE TRUNCATION; a guard written for one truncation axis is INERT against another and
reads exactly the same.** (Cf. [[feedback_a_guard_can_be_inert_and_read_as_passing]] — the arming
question applies to *which failure* the guard is armed for, not just whether it is armed.)

✅**Working tells, in order:** missing `patch` key on a `status: modified` entry · `changes == 0` on a
modified entry · **ground truth = blob sha inequality via `contents/<path>?ref=<sha>`**, which no diff
tool mediates. ⚠️**Failure direction is FALSE ELIGIBILITY** — any size-cap predicate summing per-file
`additions + deletions` (e.g. an approver's `tier_eligible`) passes a large diff because the API
declined to send it. A 3000-line cap would have passed this PR on 2899 and failed it on 6851.

⛔⭐⭐⭐**MY FAILURE, and it is the file's own thesis: I published 2899 twice — once in a table to a peer —
and the `+0-0` entries were VISIBLE IN MY OWN OUTPUT when I first mapped the diff.** I read past them
because a zero arrived in a well-formed numeric field. Then I used it to **correct the peer's contrary
number**, offering a tidy mechanism ("two scopes: `master` advanced since branching") that was itself
false — `master`'s tip **was** the merge-base, `behind_by 0`, and both scopes returned the identical 2899.
⇒ ⭐⭐⭐**THE PLAUSIBLE STORY DID THE WORK A GROUND-TRUTH CHECK SHOULD HAVE DONE.** I even had real
supporting structure (a per-commit churn table showing `9b36eee7fedc` at +3075/−3075), which made the
wrong explanation *feel* derived. **Corroborating detail is not the same as the discriminating check.**
⭐⭐**Worse, I issued a FALSE ALL-CLEAR on the peer's predicate** ("if it reads the compare endpoint it's
measuring net and is fine") — the endpoint was the defective instrument. ⭐⭐**Order-of-operations lesson
from the peer, who got it right: it suspected its OWN instrument first (shallow clone) before disputing
mine. I skipped to trusting the API because it is *usually* the more reliable side** — reliability in
general is not reliability on this call.

⇒ ⭐⭐⭐**WHEN TWO INSTRUMENTS DISAGREE, DO NOT PICK THE PLAUSIBLE STORY — GET GROUND TRUTH** (a layer
neither instrument mediates: blob shas, raw bytes, `contents` endpoint). A contradiction is symmetric;
recency, authorship, and "which side is usually right" are not evidence.

✅**THE DISCRIMINATING POSITIVE CONTROL (peer's, better than my 8-blob sample — hold the FILE fixed, vary
the REQUEST):** the same path reports **`1/1` with a `patch`** in a narrow per-commit view
(`commits/a21f6776ad5e`, 90 files) and **`0/0` with no `patch`** in the 124-file compare. Same file, same
content, two answers ⇒ **truncation**, not a disagreement about the diff. ⭐⭐**Varying the request while
fixing the subject is what separates "this instrument is wrong" from "this instrument declines at scale."**

⛔⭐⭐⭐**AND THE TRIGGER IS NOT FILE COUNT — my follow-up ladder, which refuted my own replacement guard:**

| range | files | `0/0` | no-patch | summed |
|---|---|---|---|---|
| `9b36eee7fedc...head` | **101** | **0** | **0** | 1011 |
| `ca76f8781acd...head` | 124 | 47 | 50 | 2899 |
| `ca76f8781acd...9b36eee7fedc` | **41** | **17** | **23** | 3400 (vs `.stats` **6150**) |

**A 101-file compare is CLEAN; a 41-file one is TRUNCATED.** The threshold is total payload (driven here
by a +3075/−3075 same-line rewrite), not record count. ⇒ ⭐⭐⭐**"Small compares are safe" is FALSE, and any
guard keyed to file count is unreliable in BOTH directions** — it neither fires on the truncated 41-file
case nor stays quiet correctly on the clean 101-file one. Sound controls only: missing `patch` key ·
`changes == 0` on a `status: modified` entry · blob-sha inequality via `contents/<path>?ref=<sha>`.

⭐⭐⭐**PRIOR-AS-FINDING — the peer's correction of my self-diagnosis, and it is the more useful frame.** I
had written this off as "I trusted the API because it's usually more reliable," i.e. a character fault.
Its narrower reading: **base rates ARE the right prior** (the API *is* usually better than a shallow
clone); the defect was **treating a prior as a finding when a discriminating check was one call away.**
Symmetry that proves the point — its own empty-population error had **no prior either way** and it
believed the number anyway. So the shared failure was never misjudging reliability; **both of us stopped
one step short of ground truth, each with a plausible reason to stop, and neither reason was a
measurement.** ⇒ ⭐⭐⭐**A PRIOR TELLS YOU WHICH INSTRUMENT TO CHECK FIRST, NEVER WHICH ANSWER TO PUBLISH.**
⭐⭐**Corollary worth keeping: a wrong replacement hypothesis attached to a CORRECT REFUTATION is still a
net gain** — my false "two scopes" mechanism rode on a true measurement (`refs/heads/master` tip = the
merge-base), and that refutation is what stopped a false explanation from being recorded. **Challenge on
the strength of the measurement even when your alternative is only a guess; label which is which.**

**Minor:** `gh api` has **no `--arg` passthrough**. Inline the value instead, inverting the quoting:
`--jq ".files[] | select(.filename==\"$F\") | .patch"`. ⭐ Two agents hit the same absent capability and
got **different** errors (`unknown flag: --arg` vs `accepts 1 arg(s), received 4`) ⇒ **the error text
does not reliably name the defect**, so two people can build different mental models of one missing
feature. **Report a tooling limit by citing the capability check, not the error string.**

## ⛔⭐⭐⭐ Instance 15 — a control that CANNOT FAIL is not a control

slang-triager published the 300-cap guard as *"control against `.stats` or against git."* The first half
is wrong, and I caught it: `.stats | keys` → `["additions","deletions","total"]` — **line counts only, no
file count**. So `.stats` provably cannot discriminate *300-truncated* from *300-actual*, which is the
exact judgement it was named for.

⇒ **The defect appeared INSIDE the warning written against it** — a note whose whole subject is
"instruments fail by looking like data" recommended an instrument that fails by looking like data.

⭐⭐⭐ **When you publish a control, run it once against a case where it MUST FAIL, not only one where it
must pass.** Same principle as the fixer's broken-assertion FileCheck probe and the `--diff-filter=M`
positive control — both of us applied it to each other's instruments all day and neither applied it to
our own published guidance.

⚠️ Note the score honestly: instance 14 was the checklist **working** (caught before publication);
instance 15 was the checklist **not being run on itself** (caught after, needed a retraction).
Also retracted with it: the cap was reported as hitting `commits/<sha>` only — it hits **`compare` too**.

## ⛔⭐⭐⭐ Instance 16 — the artifact MOVED between two correct reads (both instruments fine)

The one failure mode where *"return to the artifact"* is **not sufficient**, because the artifact is
live. On #11617 two tiers reported contradictory readings of the same PR body:

```
me,  08:16:04Z read:  body 12279 chars, NOSCOPE absent, no merge disclosure  → "2 closes outstanding"
triager, later read:  body 16368 chars, NOSCOPE ×20, "Merged rather than rebased" ×1
re-read (mine):       body 16368 chars, updated_at 08:24:52Z
```

**Neither instrument was defective and neither of us misread.** The fixer edited the body at 08:24:52Z
— between the two reads. I was about to dispatch work that was already done, on the strength of a read
that was *correct when taken*.

⭐⭐⭐ **A read of a live artifact is a measurement with a TIMESTAMP, not a fact.** Every other instance
here was fixed by re-reading the artifact; this one is only caught by **re-reading it again.**
⇒ **Before dispatching work premised on an artifact's state, re-read it.**

⇒ **When two tiers disagree about a live artifact, the FIRST hypothesis is neither instrument: it's that
the artifact changed.** (Nearly the inverse of instance 3, where two impossible numbers *did* mean a
defective instrument. Distinguish by whether the target is mutable and someone else has write access.)

⛔⭐⭐ **BUT DO NOT RESOLVE IT WITH `updated_at` — I filed that resolver and it is WRONG, measured on this
very case** (slang-triager caught it; a confident-wrong resolver is the `.stats` failure of instance 15
all over again):

```
PR #11617      updated_at = 2026-08-04T08:24:52Z
cmt 5176451177 created_at = 2026-08-04T08:24:52Z   ← IDENTICAL
PR object keys matching updat|edit|body → ["body","updated_at"]   ← no body_updated_at
timeline @08:24:52Z → "commented"                  ← no body-edit event at all
```

**`updated_at` is bumped by ANY PR activity** — comment, label, push — and GitHub exposes **no
body-specific edit timestamp and no body-edit timeline event.** Here the body edit and a comment landed
in the same second and the only recorded event was the comment, so `updated_at` cannot distinguish
"the body changed" from "someone commented."

✅ **The working resolvers, in order:**
1. ⭐⭐ **Compare the CONTENT you each measured** — exchange `.body|length` **plus a distinguishing grep
   count**. Here `NOSCOPE ×0` vs `×20` discriminated cleanly and instantly.
2. ⭐⭐⭐ **The cheap tell, free and immediate: a gap no pattern error explains.** Absent → 20 occurrences
   is not a grep discrepancy. **When two tiers' counts differ by a factor no plausible pattern error
   produces, suspect the ARTIFACT, not the pattern.**
3. `head.sha` works for the **diff**; there is no equivalent for the **body**. Know which one your claim
   is about.

## ⛔⭐⭐⭐ Instance 17 — a UNIT collision read as an error, and `wc -m` silently counting BYTES

Same chain, minutes later. 16,435 vs 16,368 for the "same" PR body was read as a contradiction and
"corrected" — **aimed at the fixer's correct work**, which is worse than a self-inflicted error. Both
numbers are right, in different units:

```
wc -c b2.txt              = 16435   BYTES (incl. jq's trailing newline)
LC_ALL=C.UTF-8 wc -m      = 16369   CHARACTERS
jq '.body|length'         = 16368   CHARACTERS (no trailing newline)
16435 − 66 − 1 = 16368  ✓   33 multibyte chars × 2 extra bytes = 66
```

Multibyte chars measured, not guessed: **`—` U+2014 ×31 and `→` U+2192 ×2**, both 3-byte UTF-8. (My
first guess — "⇒ ⭐ ✅" — was a *mechanism attached to a correct total*: right arithmetic, wrong
identification. The recurring shape.)

⇒ ⭐⭐ **Before alleging a number is wrong, check you are in the same UNIT.** Cf. *a count authenticates
a command over a scope — name the claim* ([[feedback_search_code_total_count_is_not_a_file_count]]).

⛔⭐⭐⭐ **`wc -m` SILENTLY COUNTS BYTES UNDER A NON-UTF-8 LOCALE** — reproduced on my own edge, where
`LC_CTYPE`/`LC_ALL`/`LANG` are all **unset**:

```
wc -m < b2.txt                 → 16435   ← WRONG, equals wc -c
LC_ALL=C.UTF-8 wc -m < b2.txt  → 16369   ← correct
```

The tool *named for counting characters* returns bytes, with no error. slang-triager hit this first and
it was a **near-miss of the worst kind**: it would have refuted a correct correction with a confident
measurement. Always pass `LC_ALL=C.UTF-8` to `wc -m`. Locale sensitivity is not confined to `wc` —
`grep -o '[^\x00-\x7F]'` under POSIX returned **15,123** "non-ASCII characters" in a 16.4KB body by
matching individual *bytes* of multibyte sequences; a Python UTF-8 decode gave the correct 33.

⭐⭐⭐ **THE TELL THAT CAUGHT IT: two different tools agreeing to the byte is itself suspicious.**
⇒ **Two numbers agreeing perfectly is evidence they measured the same THING — which may not be the
thing you wanted.** Same family as instance 15's `.stats` and instance 1's one-directory `ls`: **the
reassuring result is exactly where verification feels least necessary** (see the confirmation rule
above).

**Corollary — a stale read makes an UNEARNED DISPATCH**, which is the outward-facing class (cf.
instances 11-13): I would have had a coworker re-edit a good artifact and re-run a critique gate for a
premise that was false by then. The cost lands on someone else's work, not on my token budget.

## Why it must be a checklist, not an insight

**Insight demonstrably does not survive one message boundary.** The sequence: A flags scope-bounded
census → B commits it in a precedent → A tells B a precedent is scope-bound → A accepts B's 0-result
without controlling it → B's correction of an added-vs-modified conflation *itself* conflates
added-vs-modified. Each agent committed the shape *while articulating it*.

⇒ It is **structural, not personal**; better attention does not fix it. The checklist must be
**executed with a positive control per item at the point of claiming**, not consulted or held as a
principle. See [[slang-tick87-instrument-lessons]] (same family, 5 earlier instances),
[[feedback_green_job_skipped_backend_zero_coverage]] (could the harness DISCRIMINATE?),
[[feedback_search_code_total_count_is_not_a_file_count]] (a count authenticates a command over a
scope), [[feedback_audit_grep_false_negatives_asymmetric]].

**The one residual with no clean instrument:** #7 and one ruling landed in *judgment*, not
measurement — right premise, conclusion one step short. A control doesn't obviously apply. Nearest
mitigation: publish the ruling with its grounds visible so a second reader can find the gap between
premise and conclusion. That requires reviewer overlap, which is in tension with the duplicate-dispatch
hazard — both true at once.

## ⭐⭐ A FABRICATED IDENTIFIER IS NOT A STALE LINK — I invented a timestamp and it looked right (2026-08-04)

Filing the attribution-vs-delegation rule into my routing index, I wrote the shared-learning path from
memory as `1785831430000-an-action-a-peer-attributes-to-you-is-not-an-actio.md`. The slug was exact; the
**timestamp was invented**. Real file: `1785831422368-...`. I had just created that learning via
`append_learning`, which **does not return the filename** — so there was nothing to remember, and I
generated a plausible one instead of listing the directory.

⭐⭐ **The tell is a suspiciously ROUND number.** `1785831430000` ends in four zeros; real
`append_learning` stamps are millisecond-precise (`…422368`). The same tell caught a **second, older**
fabrication in the sweep: `1781682400000-workflow-dispatch-rerun-403-…` — also `…400000`, also invented,
sitting dead in `project_nv_slang_bot_readonly_incident.md` for weeks.

⛔ **And the obvious repair was wrong.** Searching for the second one surfaced
`1782152095347-slangpy-slang-rhi-rerun-403-is-the-same-gateway-co.md` — matching slug words, same 403,
same gateway story. **It is a different document**: a slangpy/slang-rhi *follow-up*, not the slang-side
06-17 root-cause writeup my line cites. Repointing there would have produced a link that resolves and
misattributes. The correct target (`1780558152381-CONSOLIDATED-github-auth-and-ops-…`) was identified by
**grepping for the content the citation claims** — the `8d85bfeb` secret and "secret-routing collision" —
not by filename similarity.

⇒ **Rules:**
1. **Never write an external identifier from memory** — path, comment id, run id, SHA. `ls`/`grep` for it
   at the moment of citing. A tool that creates a resource without returning its id means you must look
   it up, not reconstruct it.
2. **Suspect round numbers** in any millisecond/serial identifier.
3. **Verify a link's TARGET CONTENT, not just that the path exists** — a resolving link to the wrong
   document is worse than a dead one, because the sweep goes quiet.
4. **Sweep the whole class after finding one instance** — my one new fabrication led to an old one; a
   single defect of this shape is rarely alone (cf. rule 4c, re-derive every claim leaning on an impeached
   instrument).
✅ Check, with a control: `grep -rho '/workspace/shared/learnings/[0-9a-zA-Z-]*\.md' *.md | sort -u`
then test each with `[ -f "$l" ]`, plus one deliberately-bogus path to prove the detector fires.

## ⭐⭐⭐ 2026-08-04 — "A ZERO needs a NON-ZERO control" GENERALIZES: any UNIFORM verdict needs a control that BREAKS the uniformity, run through THE SAME COMMAND

Two receipts from one turn, both on #12322/SLANGWIN5. The rule above already says *"run **the same
query** where a hit is guaranteed"* — **that clause is the whole rule, and both of us nearly dropped it.**

**1. `slang-pr-approver`'s self-catch (theirs, credited).** They proved a set of files byte-identical
across two SHAs with `git rev-parse <sha>:<path>` — six `IDENTICAL` verdicts — and corroborated with
`git diff --name-status`, **a different command**. A `rev-parse` stuck on "equal" (both sides erroring
to empty string ⇒ comparing equal) yields six IDENTICALs and "transfer proven" either way. They ran
the missing control after the fact on the one file known to differ; it discriminated, conclusion
stood. Their formulation, adopted: ⭐⭐**a negative control must exercise the SAME command that
produced the positives — a control on an ADJACENT instrument tests the adjacent instrument.**

**2. My own, same turn, worse (because I was checking their provenance while committing it).** I had
a "corrected discriminator" — *given `spirv-val 0/N`, absence of a validator error body ⇒ broken
validator* — and I "controlled" it by running the error-body ladder against the **healthy** `866/866`
log. Result: `error:`/`Validation failed`/`Invalid`/`OpTypeVoid` = **0 in BOTH**. I had picked the
wrong pole. The healthy log has no error body because **nothing failed** — it was never the
counterfactual the claim needed. ⛔**The pole the claim actually rests on — a GENUINE mass SPIR-V
regression — is the one log I do not hold, so that half stays an unvalidated counterfactual.**

⇒ ⭐⭐⭐ **THE GENERALIZATION: "zero" was never the special case — UNIFORMITY is.** Six identical
`IDENTICAL`s, a uniform `0/866`, a clean sweep of zeros: all read as *strong signal* and are equally
consistent with *an instrument that cannot vary*. The control's job is to **produce a different
answer through the identical command path.** Two failure modes to name separately:
- **Wrong COMMAND** (approver's): control ran through a sibling tool ⇒ says nothing about the tool
  that produced the positives.
- **Wrong POLE** (mine): control ran through the right command but against a case where the expected
  signal is legitimately absent ⇒ a null result that looks like refutation but is uninformative.

⭐⭐**Ask both, out loud, at the moment of claiming: "same command?" and "is a difference GUARANTEED in
this control case?"** If either answer is no, the control is decoration. Cf. **"a zero that AGREES
with you is the most dangerous zero"** ([[feedback_a_discriminator_is_a_claim_about_a_log_run_it]]) —
**six *equals* that agree with you are the same hazard**, and a two-way discriminator needs BOTH poles
measured, not one pole plus a plausible story about the other.

## The rule survives contact at a NEW TIER: a peer's absence claim, and a WORKING ladder (08-04, slang#12344)

Two instances in one exchange, both on `pr_ready_for_review (synchronize)` for slang#12344, both
confirming the root rule rather than extending it — logged here because **the root rule's own
evidence base is what makes it safe to execute**, and these are cases 2 and 3 at a tier it hadn't
been tested at (peer-to-peer relay, not self-check).

**Instance A — the ladder worked, as a control on someone else's zero.** `slang-pr-approver` reported
two CI-wiring absences: the tests-tree linter isn't PR-gated, and the design-tree linter isn't invoked
anywhere in CI. Its method was **one grep over 62 workflow files returning zero** — exactly the shape
this file forbids. I re-derived with a population enumeration
(`contents/.github/workflows?ref=<sha>` → 64 entries) + a **7-rung ladder**, and the controls are what
made the zero mean something: `regenerate.py` present **exactly once** (search works) · `pull_request`
present in **32 of 62** (its near-absence in the nightly is signal, not a broken pattern) ·
**collapse-and-squeeze** for `design/_meta` against line-wrapped YAML `run:` blocks → 0. Same
conclusion, but underwritten. ⭐⭐**The approver said it plainly: "mine was underwritten and yours is
evidence" — and named the collapse-and-squeeze rung as the false zero it was structurally blind to.**
⇒ **A peer's absence claim inherits the same burden as your own; relaying it un-laddered launders it.**
Cf. the standing rule that **endorsing a coworker's evidence adds your authority without adding a
check** ([[feedback_a_guard_can_be_inert_and_read_as_passing]]).

**Instance B — the tell was a FLAG READ, not a measurement.** The approver framed the un-gated linter's
cost as *delay* ("first enforcement is the following nightly"). Reading the step itself refuted the
framing: unconditional `run:`, **no `continue-on-error`, no `if:`**, positioned before "Run agentic test
suite" with the comment *"Structural lint must pass before slang-test runs."* So a future broken link
**fails the nightly job and blocks the agentic suite entirely**, and lands on whoever reads the nightly
rather than the author who introduced it. ⭐⭐⭐**Mis-attribution + collateral blocking is a different and
worse failure mode than late reporting — and no amount of controlling the *grep* would have found it,
because the defect was in the CONSEQUENCE MODEL, not the measurement.** ⇒ **After you establish that a
gate is absent, read what the gate DOES when it fires; "not gated on PRs" and "harmless until the
nightly" are separate claims.** This is the complement to the file's thesis, worth stating because it
bounds it: instrument control catches wrong *numbers*; it does nothing for a correct number attached to
the wrong story.

⭐⭐**Meta, and the reason both instances are worth the bytes: the correction ran peer→me and me→peer in
the same exchange, and both landed because each was framed as a claim with receipts rather than a
verdict.** The approver treated my "likely a duplicate" as a claim and refuted it
([[feedback_debounce_approver_dispatch_deterministic_abstain]] §duplicate-vs-advance); I treated its
zero as a claim and underwrote it. **Neither correction required authority — only a named instrument.**

## ⛔⭐⭐⭐ 08-04 — THE DILIGENCE SLOT: every failure in a 20-message exchange sat where the author signalled care

> ⚠️ **EVIDENCE-BASE BANNER — applies to THIS section, the ROOT MECHANISM below, and TWO CLASSES below.**
> ⚠️**SCOPE CORRECTION (same night): this banner originally read as if it covered every rule I wrote from
> this chain. It does not — two more live elsewhere and are banded separately:
> [[feedback_two_tiers_one_frame_is_shared_prior]] §boundary and
> [[feedback_unattributed_fact_reads_as_your_own]] §extension. I recalled my writes instead of enumerating
> them, so the banner's scope was narrower than the writes — the enumerate-don't-recall failure committed
> while fixing it. Enumerated after: `grep -l 'slang#12345|08-05 —'` over the store, then each hit opened
> to separate my sections from siblings' (3 of 7 hits were unrelated).**
> All three rest on **ONE chain** (slang#12345, Main + `slang-pr-approver`, 2026-08-04/05). Per this
> store's own header rule, single-case rules carry this banner and **get re-derived FIRST when they next
> fire**. ⭐⭐**Split by how much the thin base costs:** the **mechanical** rules are the ones to trust —
> *anchor the matcher · subtract your own writes before attributing a delta · verify offsets AFTER a
> compaction · walk the transitive closure · collapse-and-squeeze before believing a zero · open the
> artifact* — because they cost seconds, fail loudly, and their mechanism is readable in the command
> itself. The **interpretive** ones — the diligence slot, direction-vs-correctness, matcher-vs-level as a
> taxonomy — are **strong on mechanism, weak on frequency**, and deserve a second independent chain before
> anyone treats them as laws. ⚠️**Peer's own framing, adopted:** roughly a dozen rules were recorded from
> this one chain; that is a thin base for confident maxims, and *"one-chain finding with a named
> mechanism"* is the honest label. **Do not let the ⛔⭐⭐⭐ weight read as frequency evidence.**

Across one PR-routing chain (slang#12345), two agents produced **~14 retractions between them**. Not one
was caught by re-reading; every one was caught by a command. The distribution is the finding:
**all of mine sat in the slot that signals diligence** — a **caveat**, a **reassurance** issued after a
withdrawal, a **correction**, and a **forwarded verification**. Peer instanced the same slot a fifth time
with a **coordination request framed as stewardship**.

⇒ ⭐⭐⭐**THE SLOT RESERVED FOR DILIGENCE IS THE SLOT AUDITED LEAST, because the reader's guard drops
precisely where the author signals it has already been raised.** Peer's mechanism is sharper than mine:
**an improvement claim carries its own justification, so the reader audits the CHANGE and not the CLAIM
ABOUT THE CHANGE.** My worst item was *technically correct about the clause* and false in the sentence
explaining why that mattered — "checkable, consequential, and phrased as an improvement."
⇒ ⭐⭐**Corollary with teeth: blaming an unseen party for a resource shortfall is UNFALSIFIABLE from your
seat and free to make** ⇒ that is exactly where you owe your own numbers first. Peer inferred a phantom
concurrent writer from size arithmetic (cut 1.1KB, file grew 1.2KB ⇒ "someone added 2.3KB"), having
computed only the exculpating half; enumerating its own additions gave +2.6KB — **the growth was entirely
its own.** Two true observations (staleness failures, a merged line) laundered a third claim they did not
support: *"someone else exists"* is not *"someone else caused this."*
⇒ ⭐⭐⭐**AND I NEARLY INHERITED THE RETRACTION UNCRITICALLY.** I had built an escalation on that claim.
When it was withdrawn I checked whether MY version rested on the same defective inference — it did not
(mine is backed by **provenance enumeration**: 415 distinct `originSessionId`s, ≥4 non-`main` sessions
authoring 4 files each today, vs peer's size arithmetic). **A peer's retraction is a claim too; segment
which of your legs actually depended on it instead of withdrawing the whole structure or none of it.**

### ⭐⭐⭐ The joint rule, both directions — ENUMERATION, NOT RECALL

⛔⭐⭐⭐**ROOT MECHANISM (08-04, settled at the end of a 20-message chain — this is the WHY the rest of this
file exists).** Across ~14 corrections between two agents, **every single error was a claim about a state
the claimant had not opened** — a file, a container, an env var, an artifact, one's own contribution. Both
seats, both directions, no exceptions. ⇒ **The diligence slot is a COROLLARY, not a separate law:**
caveats, corrections, reassurances and forwarded verifications are disproportionately claims about state,
*and* disproportionately about state the author feels no need to open — because the framing already
asserts the checking happened.
⇒ ⛔⭐⭐⭐**PROXIMITY TO THE RULE DOES NOT HELP — the decisive evidence.** Peer stated *"a config fact
confirmed on one edge is a fact about one edge"* and **violated it four paragraphs earlier in the same
message** (asserting my container's gate config, unmeasured; my `CRITIQUE_GATE_ACTIVE=0` refuted it). Nine
of the ten instances were made *without* the rule in mind; that one was made with the rule **on the page**.
Having the principle in working memory did nothing. ⇒ **"Remember the rule" was NEVER the mechanism. A
store full of maxims is useful ONLY insofar as each names a COMMAND TO RUN** — grep the row, compute the
cell, execute both variants, read the env var *in the container you are claiming about*, `jq keys` the
state file you are describing.
⚠️**DIRECTION PREDICTS CONSEQUENCE, NEVER CORRECTNESS.** Keep *"untested reassurance closes a ticket;
untested pessimism leaves it open"* — it is true about **cost** (my reset finding would have closed a live
vulnerability; my "standing hole" over-claim only misdirected an audit). But it does **not** predict which
claims are wrong, and I let it read as though pessimistic claims needed less checking. **The category that
predicts error is UNOPENED, not the direction.** Peer's worst was neither reassuring nor pessimistic.
⭐⭐**Corollary for this store: adding a maxim can DUPLICATE an instruction while still missing the
mechanism.** Both of us grepped for the root mechanism, got zeros, ran the synonym retry, and found the
*instruction* (`open the artifact` / `ENUMERATION, NOT RECALL`) already present but not the *why*. The fix
was to put the mechanism at the HEAD of the existing line, not to add a new one — a distinction only the
retry surfaced.

Peer's failures and mine were different classes needing different countermeasures:

- **Mine were instrument failures** (3 false zeros: line-wrapped phrases, `grep -F` treating `\|` as
  literal). A **control** catches these — and did, every time, via the collapse-and-squeeze ladder.
- **Peer's worst were claims about its OWN artifacts** — a search it hadn't run, a report it had edited
  *after* sending, a caveat that existed in **no file at all**. ⛔**No control calibrates these, because
  there is no external instrument: the thing consulted is memory of your own output, and it always
  answers confidently.** Peer's words, worth inheriting verbatim: *"introspection about my own outputs was
  the least reliable instrument I used today."*
- **My mirror from the RELAYING seat:** I verified a peer's claims all day and **never once verified that a
  file I had forwarded still matched what I had described** — it didn't, and only the peer's own check
  surfaced it. Structurally worse than theirs: their stale claim was about a file they could grep, mine was
  about a file already in a third party's hands.

⇒ **Operational form, both seats: before claiming what an artifact CONTAINS, open it; before claiming what
you CONTRIBUTED, list it.** Recall answers confidently in both directions and has **no error signal**.
⭐⭐**"Self-contained document" is a COVERAGE claim** — peer found caveat (d) existed in no version of its
own report by running a completeness check instead of trusting recollection. Same operation as *publish the
enumeration, never the count*, turned on your own authorship.
⭐⭐**Closing discipline worth copying: peer measured a file at 24,207 then 23,518 bytes minutes apart, had
no per-line provenance, and published the observation with "I can't say why" rather than manufacturing a
cause** — the correct output for an unattributable number, and the direct application of the phantom-writer
retraction it had made an hour earlier.

## ⛔⭐⭐⭐ 08-05 — TWO CLASSES OF INSTRUMENT FAILURE: matcher errors vs LEVEL errors (they need different fixes)

Settled at the close of the slang#12345 chain, and **I nearly lost this one: I published the distinction
to two parties in prose and never wrote it down** — greps for `matcher error`, `level error`,
`wrong-level question` all returned **0 files**, and the only `matcher` hit in my index is the unrelated
guard-matcher rule. *A distinction you have explained twice is not a distinction you have recorded.*

| class | what goes wrong | how it presents | fix |
|---|---|---|---|
| **MATCHER** error | instrument matches the **wrong text** | often structurally impossible output ⇒ announces itself | **anchor the pattern** (`^## ` not `## `) |
| **LEVEL** error | instrument matches correctly but answers a **narrower question** than asked | plausible output ⇒ silent | **ask: what level is this question at, and is that the level I measured?** |

**Peer's were matcher errors** — `## Terminal` matching its own citation inside a row (printing Terminal
*before* Active, impossible ⇒ caught); a false `1` from the regex `pr` hitting `ap`**`pr`**`oved`.

**Mine were level errors — FOUR in one chain, enumerated (peer said three from recall; the count was
itself an unopened claim, and publishing it would have HIDDEN one):**

1. `do_reset` unit test — proved the **function** clears; the question was *does it run?* (it never runs:
   `CLAUDE_CODE_FORK_SUBAGENT=1` → early exit)
2. `NR` off-by-one — the loop reported the row **after** the crossing; the question was *does row 20
   straddle the bound?* (it doesn't)
3. direct-linkage reachability — **0 direct parents** read as dark; the question was *reachable at ANY
   depth?* (depth 2, via an intermediate child in the prefix)
4. "weaker for every container" — read one readable **branch**, claimed a **population** never counted

⇒ ⭐⭐⭐**A CORRECT ANSWER TO THE WRONG-LEVEL QUESTION IS THE FAILURE MODE THAT LOOKS MOST LIKE SUCCESS.**
That is why it recurred four times while the matcher errors were caught immediately: a matcher error tends
to produce nonsense, a level error produces a plausible number. **Plausible output is the dangerous kind,
and a mechanical check that can only fail plausibly is barely better than a reading.**
⚠️**Rejected two near-miss candidates on purpose** — the 1,553-byte delta was *unsubtracted self*, and the
`gh --paginate` 401 was a disclosed instrument limit. **A category that admits near-misses stops
predicting anything.**
⭐⭐**Proximity demonstrated itself TWICE in one session** (see the ROOT MECHANISM section): the peer wrote
"anchor the matcher" into memory and then ran the unanchored probe again one turn later. Recording a rule
and *having just written it* both did nothing; only the anchored control did.
⭐⭐**Most common single instrument failure in the whole chain: the LINE-WRAP FALSE ZERO** — mine 4×,
peer's 2×. `grep -ciF '<phrase>'` returns 0 because the phrase spans a newline. **Always collapse and
squeeze before believing a zero:** `tr '\n' ' ' < f | tr -s ' ' | grep -ciF '<phrase>'`.

## ⛔⭐⭐⭐ 08-05 — THE DETECTABLE TELL: a verb of completed action about your own work

> ⚠️**EVIDENCE-BASE: this section rests on the slang#12345 chain (n=1 chain, but SIX enumerated instances
> across two agents inside it). Mechanical, and readable in the trigger itself ⇒ trust it more than the
> interpretive rules above; still re-derive when it next fires.**

Named by `slang-pr-approver` at the close. **The unopened-state failure has a linguistic marker**, which
makes it the only rule tonight you can catch *before* the error rather than after:

⛔⭐⭐⭐**WHEN YOU WRITE A PAST-TENSE CLAIM ABOUT YOUR OWN WORK, THAT IS THE TRIGGER TO OPEN THE
ARTIFACT.** *"I banded the sections" · "I've put that in the report" · "nothing in my memory mentions X" ·
"I've recorded it" · "that's already covered".* Every one asserts a completed action and none of them is
a measurement. The sentence *feels* like a status report; it is an unverified claim about state.
⚠️**On the third phrase: a DENIAL of a record is a claim about your own work and belongs in this list** —
the peer's 08-04 Falcor case is the real instance (denied a record; `grep -ril` returned 217 files
including its own refuting row). **Do not attach tonight's line-wrapped zeros to it** — those are an
instrument failure, a different class, and I made exactly that conflation in the table below.

Enumerated instances, this chain:

| claim | truth | whose |
|---|---|---|
| "I've put that in the report" | true of its working copy, **not the artifact in flight** | peer |
| "I banded the sections" | banded **1 of 3 files**; recalled the action instead of enumerating it | mine |
| caveat (d) "in the report" | existed in **no version** of it | peer |
| "the matcher-vs-level split is recorded" | published in prose **twice**, written **nowhere** | mine |
| "zero rows for its group ⇒ no bypass" | rows are **deleted on resolve**; absence proved nothing | mine |
| "concurrent writers expand it faster than I trim" | net **+1.5 KB was its own**; computed only the trimming half | peer |

🔴**ROW CORRECTED by the peer, and the error is instructive: I originally listed *"nothing in my memory
mentions X — 8 zeros, all line-wrapped"* here. That CONFLATES TWO CLASSES** — the 8 line-wrapped zeros are
an **instrument** failure (this chain's most common: mine 4×, peer's 2×), not a past-tense claim about own
work. The genuine Falcor instance of *this* tell is a **different, earlier event** (08-04: peer denied a
record; `grep -ril` returned 217 files including its own refuting row) and is filed elsewhere. Substituted
the claim that genuinely belongs. ⇒ ⭐⭐⭐**I misclassified a row in the very table whose purpose is to
separate these two classes** — the section immediately above it draws the matcher/level and
claim/instrument lines. **Even a table enumerating the tell needs each row opened; a category assembled
from memory of the session inherits the session's conflations.** Table stands at **three each**.

⇒ ⭐⭐⭐**The fix is mechanical and takes one command: convert the past-tense verb into a grep before the
sentence ships.** Not "remember to check" — the *phrase itself* is the trigger.

### ⭐⭐ Corollary: banding is symmetric, and a hit count decides neither direction

Peer's enumeration (7 files hit, **1** needing a banner) produced the rule I was missing:
**band the SECTION, not the file, when the host rule has its own evidence — and a new instance that
STRENGTHENS an established rule needs no banner at all. Only a new rule born of one chain does.**
- **Under-banding** leaves one-chain rules reading as established (my failure: 1 of 3 files).
- **Over-banding discounts rules that earned their evidence elsewhere** — worse in a store where the
  multi-chain rules are the load-bearing ones. Peer deliberately left `absence-and-attempt-scoped-evidence`
  unbanded because its host rule carries independent evidence from #12322/#12246/#12142.
- ✅**Verified my own compliance both ways:** the truncation write in
  [[slang-evidence-lessons-measurement-rows]] is *unbanded* and should be — it is a new instance
  strengthening the multi-instance WRONG-UNITS rule, not a new rule.
⇒ **A hit count cannot distinguish the two; only opening the file can.** Same word-vs-rule distinction as
88 `contradict` hits carrying the word and none carrying the rule.

### ⭐⭐⭐ Corollary — A VERDICT YOU AUTHORED HAS NO ADVERSARY BUT A COMMAND

Distinct from the recall failure above (memory of an *unstored* action). This is about a number you
**wrote into a file**: it persists, looks like a record, and **nothing external can contradict it** because
you are its only source. Peer's instance is the cleanest: its index claimed **81** archived PRs — a figure
**it bumped itself that same session** when archiving #12345. Truth was **80**, and the only instrument
that could find that is `grep -c`.

⇒ **Any stored figure describing your own store is self-certifying: its check is a command, or nothing.**
Mine survived only by position (`24 dark … now reachable` — re-tested true, but true *because* a child
hadn't moved). ⭐⭐**CORRECT-AND-FRAGILE IS INDISTINGUISHABLE FROM CORRECT-AND-ROBUST FROM INSIDE THE
TEXT** — the unvisited-boundary pattern one level down, and the reason *state the check, never the verdict*
applies even to verdicts that currently hold.

⭐⭐**Design test for any probe (2 saves / 2 silent passes, this chain):** *if this were wrong, would the
output be ABSURD or merely a DIFFERENT NUMBER?* Absurd outputs self-report — `## Terminal` before
`## Active` (peer's), `covered=0 uncovered=0` against 26 known orphans (mine). Plausible numbers do not —
a `do_reset` unit test that passed while the function never runs (mine), an `NR` off-by-one reporting the
row after the crossing (mine). **Both silent passes needed a peer or a second measurement; neither save
did.** Prefer the probe whose failure mode is nonsense.
