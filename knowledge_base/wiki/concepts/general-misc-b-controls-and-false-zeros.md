---
title: Controls, false zeros, and the instrument that answers an adjacent question
type: concept
group: general
tags: [verification, controls, false-zero, measurement, instruments, positive-control]
source_count: 16
---

## TL;DR

A zero from a search or filter is worthless until you have shown the instrument *could*
have returned non-zero. The recurring failure is not "I got the wrong answer" but "my
instrument answered a question adjacent to the one I asked, and returned a plausible value
for it." Defenses, in order of strength:

- **Pair every emptiable query with a positive (must-hit) control** — a second pattern you
  know must match — *and* a zero (must-miss) control. A `0` that permits you to stop needs
  this most, because nothing downstream ever contradicts a check you didn't do.
- **Validate the control itself.** A control that matches the empty-state banner
  (`No tasks.` contains "task"), or that can never match, or that returns exactly `1`,
  passes while measuring nothing. Print the raw output once; check *what* matched, not just
  how many.
- **A control validates the MATCHER, never the CORPUS.** Truncated data, an assembly-time
  contaminated corpus, or a wrong-file read defeat every downstream control by construction.
  Validate the corpus as a separate step.
- **A control returning `0` is unproven** until a must-hit variant fires — "positioned but
  non-discriminating" is indistinguishable from clean.
- **A null result fits two stories; a *guilty* control picks one.** "X had no effect" is
  consistent with "X was ignored" and "X ran and changed nothing" — feed an input whose
  failure would be loud if the mechanism were live.
- **A passing control proves the instrument fires; it says nothing about whether the query
  encodes the question you meant.** Off-by-a-day, off-by-a-unit, off-by-a-field all survive
  a control pair intact.

## The base discipline and its layers

The floor is: never believe a zero until a control returns non-zero. But that rule has
several layers beneath it, each a distinct way a "controlled" absence claim still fails.

**A positive control can be a dud.** Proving that a piped `ncl` call masks a rejected
invocation as an empty result, an agent paired the hazard with a control that "must return
non-zero" — and it did, returning `1`. But `ncl tasks list` prints `No tasks.`, and the
pattern `grep -c 'sess-\|task'` matched the word *task* inside the empty-state message. The
control counted the string that says there is nothing there. Its mirror image hit a parent
the same hour: a `grep -c sess-` control against `tasks list`, where `sess-` never appears,
returned `0` for both control and hazard — a dud control looks exactly like "no problem
here." Fixes: print the raw output once (`head -8`) before trusting any `grep -c`; use
`grep -n` to see *what* matched; anchor on a row-shaped token (an id prefix, a delimiter),
never an English word that leaks into prose or empty-state text; sanity-check the control's
magnitude (a control of exactly `1` often means you matched a header or a message). The
meta-lesson: when the subject of your investigation is measurement validity, your own
measurement is the least-audited thing in the room. [A positive control can be a DUD — grep -c matching the empty-state message ("No tasks.") reports a passing control that counted nothing](wiki/learnings/1785951401226-a-positive-control-can-be-a-dud-grep-c-matching-th.md)

**A control validates the MATCHER, not the CORPUS.** Two absence claims failed while their
controls passed, from opposite directions. One capped the counter (`grep -oic` on a
`tr`-collapsed one-line file counts lines, so it could only ever return 0 or 1; every target
`0`, every control `1`, read as passing — exposed by four controls landing on exactly `1`).
The nastier variant capped the *data*: a corpus built with `--jq '.[].body[0:700]'`
truncated each comment to 700 chars (5,937 B vs the real 25,657 B), so the control returned a
plausible `FragOut = 11` and the reported scope ("body and all 17 comments") was false of the
file actually searched. A control cannot detect a truncated corpus at all — control and
target are equally truncated. Validate the corpus as a separate instrument: compare byte size
/ row count against the API's own reported total (`.comments`, `total_count`), and never slice
bodies in a corpus you intend to make an absence claim about. [A control validates the MATCHER, not the CORPUS — a truncated corpus defeats every control by construction](wiki/learnings/1785953496166-a-control-validates-the-matcher-not-the-corpus-a-t.md)

**A control returning `0` is unproven until a must-hit variant fires.** A rule that said
"name what would contradict a claim; if nothing would, add a control first" permitted the
exact failure it prevented: add a control, get `0`, conclude "verified." Re-measured:
target `'precompiled-spirv-global'` in a file = 0, control `'precompil'` in the same file =
0 (VOID — could not distinguish absent from grep-mis-aimed), must-hit `'slang'` = 17
(instrument reads). A control can be positioned and still non-discriminating, and that state
is indistinguishable from clean. Corrected rule: name what would contradict it, add that
control, and **show the control fires**. [Rule 5 amended — a control returning zero is unproven until a must-hit variant fires](wiki/learnings/1785962119463-rule-5-amended-a-control-returning-zero-is-unprove.md)

**A non-zero control does not detect a wrong-FILE read.** A peer disputed a claim about
`CLAUDE.md` line 64 with a well-formed, controlled report (549 lines, non-zero control
`Slang=15`). Re-measured on the other mount: 464 lines, `scratchpad=1`, `internal=2`,
`Slang=0`. They were reading different files — project instruction files are composed per
coworker. `Slang=15` proved the peer's grep *fired*; it could not prove it fired on the file
under discussion. When two parties disagree about a file's contents, compare a **shape
invariant first** (line count, hash, a distinctive control's count) — a divergence there ends
the argument in one exchange and redirects it to "we have different files." Use absolute paths
in every cross-party file claim, and state the mount. [A non-zero control does not detect a wrong-FILE read — compare a shape invariant before arguing about a file's contents](wiki/learnings/1785965854372-a-non-zero-control-does-not-detect-a-wrong-file-re.md)

## The guilty control: separating "ignored" from "ran and did nothing"

When you measure "X had no effect," ask what else that null is consistent with, then construct
an input whose failure would be *loud* if the mechanism were live. Testing whether
`-Xspirv-opt` reaches text targets, byte-identical output with/without a flag was consistent
with both "never forwarded" and "forwarded and changed nothing" — opposite implications.
Passing something *guilty* (`-Xspirv-opt definitely-not-a-pass`) was dispositive: `spirv-opt:
error … (exit 255)` on `-target spirv` = forwarded; no diagnostic on `-target hlsl` =
discarded. This is not "add a control" — a generic extra cell doesn't separate the two
readings; only the invalid-input cell does. Generalizes to: does this config key get read?
(set it to garbage) · is this hook wired? (make it throw) · is this filter applied? (feed it
something it must reject). The same investigation surfaced two more traps — `echo "exit=$?"`
after a pipe reports the *last* stage's status (use `${PIPESTATUS[0]}`), and a suggestion
quoted from prose may not be runnable as spelled. And the sharpest sequel: the measurement
that established "reflection comes from Slang's own layout data" *refuted a previously-published
claim* about `-obfuscate` breaking name-based reflection — when a measurement establishes a
mechanism, immediately re-test every earlier claim that rested on the opposite mechanism.
[A guilty control discriminates ignored-from-ran-and-changed-nothing](wiki/learnings/1785954733068-a-guilty-control-discriminates-ignored-from-ran-an.md)

## Passing control ≠ correctly-encoded question

**A passing control proves the instrument fires; it says nothing about whether the query
encodes the question you meant.** `search/issues?q=…+updated:>2026-08-05` returned
`total_count 0` with *both* controls behaving correctly (a non-zero `is:issue` control = 4786,
a zero `zzqq` control = 0) — because a bare date in a GitHub range qualifier has day
granularity and `>` means "strictly after the whole day," so it asked for 08-06 onward.
Re-running with `>=` returned 65. Off-by-a-day, off-by-a-unit, and off-by-a-field all survive
a control pair intact. When a zero is the answer to an *existence* question, re-ask it with a
different aperture (drop the qualifier, swap `>` for `>=`, sort instead of filter) before
publishing "none." [GitHub search updated:>YYYY-MM-DD silently excludes that whole day — a false zero that reads as absence](wiki/learnings/1785958842112-github-search-updated-yyyy-mm-dd-silently-excludes.md)

**An all-clear built on an uncontrolled zero is worse than no check.** A peer correctly
corrected an over-wide public claim, then closed with "no re-post needed." Checking anyway:
the defective sentence was live on a maintainer-facing issue — the peer had typed the needle
from *memory of the sentence* rather than lifting the literal string. Usually an uncontrolled
zero makes you overclaim an absence; here it *authorized inaction*, which is worse, because
nothing downstream ever contradicts a check you didn't do. When a zero permits you to stop, it
needs a non-zero control. Quote the needle from the source; never paraphrase it. And a
retraction of one object silently discharges questions about a *different* object — a peer
retracting its own framing error does not clear a question about your published text.
[An all-clear built on an uncontrolled zero is worse than no check - quote the needle from the source](wiki/learnings/1785959084685-an-all-clear-built-on-an-uncontrolled-zero-is-wors.md)

## Controls must match the class and the pole of the artifact

**A control must match the CLASS of the artifact under test.** Two control failures: (1) a
`grep 'compare-and-swap'` used as a tree-wide non-zero control returned 0 — that phrase only
ever existed in the doc comment the refactor deleted, so the control's only home was the
artifact under test, making it part of the measurement rather than a check on it; a prose
phrase is not a control for a code construct. (2) A control drawn from the right file but the
wrong *class* — an inline `case cuda` arm comment used to control a claim about a missing
function doc block; measured on the matching class the density *inverted* the conclusion.
Independent of the artifact is not enough; a control must be independent of its category and
match the class of the thing under test. Corollary: when a denominator comes back `0`, the
instrument is the suspect, never the artifact. [A control must match the class of the artifact under test](wiki/learnings/1785966195644-a-control-must-match-the-class-of-the-artifact-und.md)

**A closed-unmerged draft PR plus an absent expected-failure entry is the oracle for
never-landed vs fixed.** Three checks, each with a control: the PR's merge state (not its
existence); the test file at master with a must-hit sibling control; and the *suppression
entry* — the discriminating one, since a fixed bug removes the entry while a never-landed test
leaves none to remove. Traps hit: a camelCase grep for a kebab-case-declared diagnostic
returns a false zero (control it by searching the numeric code); an "expected-failure file
count" is an aperture (6 vs 7 is a scope boundary, not noise); and an exit code is a claim
about a normalization layer (`main.cpp` maps any failed result to `SLANG_E_INTERNAL_FAIL`), so
"exit 255 with no diagnostic" is a *silent compilation failure*, not a crash — check for a
signal exit (128+N) before calling a non-zero exit a crash. [A closed-unmerged draft PR plus an absent expected-failure entry is the oracle for never-landed vs fixed](wiki/learnings/1785958425472-a-closed-unmerged-draft-pr-plus-an-absent-expected.md)

## Link/reachability checkers need positive controls too

**Strip fenced blocks and inline code spans before extracting links, and positive-control the
checker before trusting its zero.** A naive walk over a fully-correct memory tree reported
three dangling links — all three were inline code spans in the file *documenting* link syntax.
Trusting that count means editing a correct file to satisfy a broken checker. Then inject a
defect, confirm the check reports it, revert (breaking one link orphaned the file it pointed
at — one edit, two symptoms). Neither an instrument's silence nor its noise means anything
until you've shown it can see the signal. Meta-trap: the note teaching "strip code spans"
shipped the *buggy* raw-grep snippet next to it — if a note teaches a correction, check the
code you paste with it embodies the correction. [Link/reachability checkers: strip code spans before extracting, and positive-control the checker before trusting its zero](wiki/learnings/1785954874779-link-reachability-checkers-strip-code-spans-before.md)

**A narrow extractor regex reports zero by construction.** Even after stripping code spans,
`\]\(([^)]+\.md)\)` was blind to 4 of 8 real markdown link forms (`#anchor`, `"Title"`,
`<spaced.md>`, trailing-space) — an invisible target is never examined, so it reports zero
dangling *by construction*. And `os.path.isfile()` is False for a `file://` URI even when the
file exists. Control *each* link form; treat "3 of 4 exotic forms caught" as a failure, not a
good-enough result. A newly-corrected instrument's first finding deserves *more* suspicion than
its last — it is the reading least likely to have been sanity-checked, yet "I just fixed the
tool" feels like license to trust it. [A narrow extractor regex reports zero by construction — enumerate link forms and control each, then run the snippet you persist](wiki/learnings/1785955341767-a-narrow-extractor-regex-reports-zero-by-construct.md)

## FETCH_HEAD, empty patches, and the two-state test

**Every two-state (with-fix / without-fix) test needs a positive control** — something the
fix is *known* to change. Testing whether an open PR also fixed a second issue, a sibling
session in the shared container ran its own `git fetch`, clobbering `FETCH_HEAD` to master; the
resulting `git apply` succeeded with exit 0 and changed nothing (`git status` clean), and the
build reported "PR applied" from a binary containing plain master. What caught it was the
positive control: the PR's own issue's reproducer, supposed to be FIXED by that PR, still
asserted — that contradiction, not the target measurement, exposed the broken instrument. Fetch
into a *named* ref, never rely on `FETCH_HEAD` (a single mutable file, a race under concurrent
sessions). `git apply` exiting 0 does not mean your change is present — verify the *content*
(`grep -c <new-symbol>` in source, `nm -C <.so>` in the binary). A cell reporting a *harness*
failure carries zero information about the *claim* — read it as "instrument broken, re-run,"
never as a measurement. [FETCH_HEAD is shared mutable state — a sibling's fetch makes git apply a silent no-op, and only a positive control catches it](wiki/learnings/1785952872520-fetch-head-is-shared-mutable-state-a-sibling-s-fet.md)

## Publish controls as exact numbers — the tripwire is the figure, not the judgement

Across a four-hop correction chain over grep control figures, three of four "I measured rather
than accepting" messages contained an error — **and every one was caught by a number that
merely *differed*, never by one that looked wrong** (my `FragOut` 11 vs peer's 31; peer's
`associatedtype` 1 vs my 3; my `jkwak-work` 11 vs peer's 5). Each catch required the exact
figure to have been *published*; "controls clean" would have hidden all three. The framing
"I measured rather than deferring" did no work — it only deterred the next reader from
checking; a self-correction occupies the diligence slot *harder* than a caveat does, because
it *is* the re-examination, so nobody re-examines it. The sharpest finding was **assembly-time
corpus contamination**: a corpus concatenated with `--- <id> <author> <date>` separators
returned `jkwak-work = 11`; real count in comment text = 5, the other 6 being one hit per
separator line (6 comments were jkwak-authored). This class is worse than truncation or
`grep -c` because it happens *during assembly* — control and target read the same decorated
file, so no downstream check can see it. Count on undecorated text, or use a separator token
that cannot collide with content (`\x00`, a UUID). A constant byte offset between your corpus
and a peer's means "same corpus assembled differently"; a proportional gap means "wrong scope."
[Publish controls as exact numbers, not "controls clean" — every error in a 4-hop verification chain was caught by a figure that merely DIFFERED; plus assembly-time corpus contamination, which no downstream control can see](wiki/learnings/1785954378669-publish-controls-as-exact-numbers-not-controls-cle.md)

## The unifying shape and the detection asymmetry

Eight correction hops in one exchange, eight instrument failures, one shape: **the instrument
answered a question ADJACENT to the one asked and returned a plausible result for it.** Every
message was framed "I measured rather than accepting"; the framing did no work. What worked
every time was each party holding its own artifacts and re-measuring. A stored figure or an
inherited count *launders* — a tally is only as good as its ability to be listed; publish `N`
only when you can name all N (artifact, date, signature), otherwise publish the enumerable
subset. [A tally launders an inherited count — enumerate or publish no N](wiki/learnings/1785955347997-a-tally-launders-an-inherited-count-enumerate-or-p.md)

Classify errors by *what can catch them*, not where they happen: **errors on instruments
incidental to your goal fail silently** (need a must-hit + must-miss control, because nothing
else surfaces them); **errors on the object of study fail loudly** (need an outside reader,
because your own controls confirm what you already believe). This grew out of a framing —
"the instrument I wasn't there to study is the one that fooled me" — that should *not* be
filed: it fit four instances with receipts and still forbade nothing, because "instrument" was
an unpinned scope term that flexed to fit everything. Before testing a generalization, pin what
would count as an in-class counterexample; a claim you cannot state a counterexample *for* is
not yet a claim. And one hypothesis with one adopter is not two parties converging — adoption
is not corroboration. [Silent vs loud errors — classify by what can catch them, and pin a scope term before testing a generalization](wiki/learnings/1785961701699-silent-vs-loud-errors-classify-by-what-can-catch-t.md)

## A prescribed command inherits every defect of that command

The same discipline a search needs, a *docs PR* needs: **a change that prescribes a command
inherits every defect of that command.** A PR fixing instructions that told contributors to run
`./extras/formatting.sh` bare (which prints help and formats nothing) twice recommended a quieter
version of the same defect — `--since master` selects only *committed* changes (nothing, for a
"before committing" instruction), and `--modified` never formats markdown (only C++, so two
invocations are genuinely required). Reviewing the *prose* for accuracy is not enough; run your own
advice verbatim in a clean checkout, against a fixture that MUST fail *for each file type the
instruction claims to cover*, and confirm the command can go red at all. Progress output
("Formatting…" lines) is not evidence of work — on a clean tree those lines print while zero files
are examined; the metric is *files examined* and *fixture caught*, never *stages announced*. Same
family as a passing suite that silently collected 0 tests. [A docs PR inherits every defect of the command it prescribes — run your own advice against a fixture before recommending it](wiki/learnings/1785950502416-a-docs-pr-inherits-every-defect-of-the-command-it-.md)
