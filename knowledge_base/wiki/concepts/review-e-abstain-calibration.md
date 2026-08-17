---
title: "Approver decision procedure — the abstain/severity calibration bar"
type: concept
group: review
tags: [pr-approver, abstain, severity, calibration, human-disagreement, false-safe, clause-gap, join-scoring]
source_count: 12
---

## TL;DR

The approver's job is one auditable verdict (WOULD_APPROVE | ABSTAIN_POLICY |
ABSTAIN_INFRA | BLOCK). These atoms are the hard-won calibration of the *bar*:

- **Severity and intent are orthogonal.** "The author did this on purpose / tested
  it" proves intent, never that the consequence is safe. Clear a gap only in the
  bar's own vocabulary — *trigger unreachable*, *covered elsewhere*, *pure
  future-proofing* — never "deliberate."
- **Incremental hardening PRs get a monotonicity bar, not a completeness bar.** "It
  doesn't *also* fix the adjacent pre-existing case" is a scope preference, not an
  OPEN_GAP. If N gaps all reduce to "incomplete scope," that is *one* signal, not N.
- **Cost-to-fix is not evidence about severity.** "The fix is free, so the bar goes
  up" is backwards — a costless fix is a reason to *suggest*, never to *withhold*.
- **An undeclared policy is weak evidence *for* the change, not a neutral void** to
  fill with caution. Abstaining on an undeclared rule imposes a bar the repo never
  adopted.
- **An abstain must price severity, not just uncertainty.** "The code asks the wrong
  question" is a code-quality finding; "it misbehaves on a real configuration" is
  merge-blocking. Urgency (reachable, silent) without severity is not a hold.
- **The join is the only instrument that detects a false abstain.** "ABSTAIN rows are
  excluded from scoring" hides the entire over-conservative direction — it was
  retracted. Make every abstain a falsifiable prediction and score the loss; a clean
  human APPROVE at your exact head, merging unchanged, refutes an OPEN_GAP.
- **A bad scoreboard is not evidence the next abstain is wrong.** Calibration
  pressure ("my last two were over-conservative losses") silently rewrites the
  decision bar; the procedure is the mechanism, your recent record is not.

Measured pattern: ~91% of abstains reaching a decisive human verdict were approved.
The value of an abstain comes from being a *scored prediction*, not from "a human
must look" (which is unfalsifiable and scores every abstain correct).

## Severity vs intent, and the clearing vocabulary

The severity bar asks whether a gap is *inconsequential*: trigger unreachable,
covered elsewhere, or pure future-proofing. The pull toward the wrong, easier
question — *is it intentional?* — is strong because evidence of intent is cheap (a
test name, an assertion) while evidence about consequence requires tracing the
failure path. A deliberate, well-tested decision can carry a large blast radius; the
test proves the author *meant* it and says nothing about whether a maintainer
*accepts* it. Never launder a test into a severity clear, and treat any "unresolved /
could not determine" note elsewhere in the same reasoning as disqualifying for a
clear
[[approver/critique-mustfix] "Deliberate and tested" is not "inconsequential" — intent and consequence are orthogonal in gap-severity calls](wiki/learnings/1786113456723-approver-critique-mustfix-deliberate-and-tested-is.md).

A related mis-import: **check which side of a rule your reason is listed on.** On
slang-rhi#815 a "fails closed, so the consequence is small" argument cleared an
untested public-API rejection branch — but blast radius appears in the gap-severity
bar only on the *abstain* side. And "fails closed" describes the guard *as currently
written*; a negative test exists to catch a *regression* of that guard, after which
the same handle fails *open*. Citing the right precedent is not applying it — state
the comparison as a checkable claim ("X fails OPEN on regression BECAUSE…"), not a
label ("opposite direction"). (Both from the join-scoring / calibration-pressure atom
discussed under *The join* below.)

## The incremental-hardening shape

slangpy#1094 merged unchanged at the decided commit with three OPEN_GAPs overruled.
All three collapsed to one shape — *this incremental improvement is incomplete* —
mistaken for three independent signals. None asserted the change made anything
*worse*; each said it didn't go far enough. For a hardening PR the maintainer's bar is
**monotonic improvement**, not completeness. The strongest tell was ignored: gap 1
was explicitly established as *not a regression* (a pre-existing unguarded call), then
counted anyway. Before abstaining on a robustness PR, ask of each gap: *does this make
anything worse than the pre-PR state, or only less-good than ideal?* Worse ⇒ real gap;
pre-existing-left-unaddressed ⇒ scope preference, clear it; deliberate tested tradeoff
⇒ maintainer's call, weak grounds alone; missing success-direction test ⇒ about
*confidence in* the improvement, rank below anything asserting incorrectness. And a
CodeRabbit `🟠 Major` + `⚡ Quick win` is bot vocabulary for *optional polish*, and a
resolved-without-reply thread is a maintainer signal
[[approver/human-disagreement] On an incremental hardening PR, "didn't also fix the adjacent pre-existing case" is a scope preference, not an OPEN_GAP](wiki/learnings/1786115791032-approver-human-disagreement-on-an-incremental-hard.md).
This cuts against the "deliberate ≠ inconsequential" rule above — sound in isolation,
but it must not convert every intentional tradeoff in an improving change into a
blocker.

The mirror shape is **mirror-arm + doc-sync**: a new `else if (cuda)` arm doing for
`"nvrtc"` exactly what the adjacent arm does for `"dxc"`, plus generated `py_doc.h`
matching the header verbatim. Cheap positive signals — in-file precedent, structural
symmetry with no new state/ordering/lifetime, generator run, checked cache-key safety
— make it low-risk. "Untestable in this CI" (no CUDA runner) ≠ "dead code"; the setter
is the caller, which is a milder finding than "this flag is never set". None of that
licenses inventing a verdict when the harness produced none
[[approver/human-disagreement] ABSTAIN_INFRA on a green-CI doc+mirror-arm PR: the abstain was procedurally right and outcome-wrong; log the shape, not the regret](wiki/learnings/1786117966658-approver-human-disagreement-abstain-infra-on-a-gre.md).

## Cost-to-fix and undeclared policy

On the slang-rhi#814 mid-list public-enum insertion, the argument that failed hardest
was "the fix is free, so the bar to clear goes UP." Cost-to-fix is not evidence about
severity: a maintainer who considers the exposure immaterial gains nothing from a free
fix to an immaterial problem — cheapness matters only *after* impact is established. A
costless fix is a reason to *suggest*, never to *withhold*. The maintainer (the
requested code owner, not the author) APPROVED the insertion blob-identical and
intact, meeting the pre-registered falsification condition ⇒ scored over-conservative.
Under-weighted counter-evidence pointed the same way: no cross-build persistence, an
immune string-keyed access path, no range arithmetic, and the repo ships no releases
so the ABI story is hypothetical. **An undeclared policy is weak evidence *for* the
change, not a neutral void** — abstaining on it imposes a compatibility bar the repo
never adopted and charges maintainers to rebut it
[[approver/human-disagreement] Mid-list public-enum insertion: code owner APPROVED it intact — my ABI abstain was over-conservative, and the free-fix argument is the part that failed](wiki/learnings/1786116630701-approver-human-disagreement-mid-list-public-enum-i.md).

A subtler version of the same "consult the artifact you already hold": before writing
"no written policy exists" about a compatibility construct, grep the *sibling* repo's
instruction files — a *loaded* document is not a *consulted* document. slang's
`CLAUDE.md` states the never-insert-mid-list enum rule in prose that was in loaded
context the whole time, yet the remedy was re-derived from the diff. A written rule in
a non-governing repo is **evidence for the humans, never a clause to enforce** — hand
it over, don't apply it (grepping slang for `slang-rhi` ⇒ 0 hits ⇒ it doesn't govern
slang-rhi)
[[approver/clause-gap] Before writing "no written policy exists", grep the SIBLING repo's instruction files — a loaded document is not a consulted document](wiki/learnings/1786112081588-approver-clause-gap-before-writing-no-written-poli.md).

## Pricing severity: the #817 false-abstain

Five consecutive OPEN_GAP rows on slang-rhi#817, all overruled when the code shipped
byte-identical. The finding was *real* — a silent `CopyDestination` strip derived from
`linearTilingFeatures` on an optimal-tiled swapchain image, independently reached by a
peer. But **"the predicate asks the wrong question" was established; "it produces a
wrong answer on a real configuration" never was.** The unclosed conjunction needed
both (i) the tiling asymmetry on a selectable format *and* (ii) a surface advertising
`TRANSFER_DST` — (ii) was never measured. The consequence was a *lost capability* on a
device minority, not corrupted output, against a change fixing a *demonstrated* SRGB
bug. An abstain must price severity, not just uncertainty; "I cannot rule this out"
became "a human must look" when the honest framing was "narrow, low-severity,
unmeasured risk on a change that fixes a measured bug." **Weigh what the change fixes
against what it might break** — a verdict that only totals risks will systematically
under-approve. And a five-abstain streak on byte-identical heads is a signal about the
*bar* (loss #7 on this repo), not the PR
[[approver/false-safe] #817 merged with my abstained bytes byte-identical — 5 abstain rows overruled, and the gap I held on was REAL but I never established it FIRES](wiki/learnings/1786347918704-approver-false-safe-817-merged-with-my-abstained-b.md).

## The join, and calibration pressure

An ABSTAIN the human *overrules* is precisely the false-abstain signal; excluding
abstain rows from scoring means the loop only ever punishes false-APPROVES, so the
over-conservative miss rate is structurally invisible. The retracted "abstains are
excluded" rule had to die because without the join a withheld approval on a correct
fix counts as a success. The falsifiability test for any abstain post-mortem: *state
what outcome would have proven the abstain wrong* — if none could, it was a refusal to
judge, not a judgment. A critique can be right about the reasoning flaw and still
overshoot on severity; validity and severity are separate judgments, and severity's
cost only shows at join time. If your cited precedent has a named author, check
whether they're a pending reviewer — when the question is "is this the library's
intended contract?", the precedent-author's review *is* the answer, not corroboration
[[approver/human-disagreement] An ABSTAIN the human OVERRULES is the false-abstain signal — "abstain rows are excluded from scoring" hides the entire over-conservative direction; plus: if your cited precedent has a named author, check whether they're a pending reviewer](wiki/learnings/1786113486048-approver-human-disagreement-an-abstain-the-human-o.md).

Calibration pressure is the sharpest self-deception: two recent over-conservative
losses on the same repo+author silently substituted a *join-scoring* frame ("material
enough not to merge as-is") for the *decision* bar, swapping a conservative test for a
permissive one in exactly the direction the losses pushed. **A repurposed rule is the
hardest self-deception to spot — every ingredient is something you legitimately
learned; the tell is a rule appearing at a decision point it wasn't written for.** Ask
of any standard: *was this written to decide, or to score?* The countermeasure that
worked: **name your suspected bias in the critique prompt** — self-review cannot see
this class, an independent reviewer handed the hypothesis will test it. (Second-order:
having just been corrected for leaning permissive, the next round overstated in the
*conservative* direction — the bias follows the position, not a fixed direction.)
[[approver/challenger-miss] I used a join-scoring rule as a decision rule — how a bad scoreboard loosens the next decision's bar](wiki/learnings/1786119044642-approver-challenger-miss-i-used-a-join-scoring-rul.md).

## Clause-gap: the artifact isn't ready, or the pipeline re-fired

**Empty PR body on a fresh PR is a timing race, not maintainer silence.** slangpy#1094
rested a gap on "the PR has no description" — the body was populated 58 min *after* the
decision (`diff: null` on the creation-time `userContentEdits` = empty-at-creation, 7
of 21 slangpy PRs). This is a *wait-for-settled-artifact* case, structurally identical
to the harvest exit-22 `pending_bot` rule; re-reading before finalizing could not have
caught it. Absence of a statement in a not-yet-written field carries zero bits — the
negative-evidence probe applies to artifact *readiness*
[[approver/clause-gap] An empty PR body on a fresh PR is a timing race, not maintainer silence — and not a staleness bug either](wiki/learnings/1786116951498-approver-clause-gap-an-empty-pr-body-on-a-fresh-pr.md).

**A merge-from-main head move is a new SHA with an unchanged reviewed diff.** It
mechanically re-fires the whole pipeline (newest review's `commit_id` ≠ pinned head ⇒
stale). Prove it with agent-*unwritable* instruments — parent count, PR diff sha256,
per-file blob identity across heads — then *decline the row without laundering the SHA*
into `commit_id` (the field a deterministic clause reads must keep reporting what the
bot actually reviewed; a substantive exception belongs in a separately-named clause).
State the re-trigger condition in terms of *content*, not SHA, and record which heads
have no row so a later join can't attach a human verdict to a merge-only SHA
[[approver/clause-gap] A merge-from-main head move is a new SHA with an unchanged reviewed diff — prove it by blob identity, then decline the row without laundering the SHA](wiki/learnings/1786115207025-approver-clause-gap-a-merge-from-main-head-move-is.md).

**OUT_OF_SCOPE has no scripted predicate, and the conflict-of-interest case needs it
most.** A PR patching the approver's own Devin scraper is `OUT_OF_SCOPE:approver-
harness`, but the policy JSON has no repo-class or COI predicate, so the call rests on
recalling precedent — and on the run in question 6/6 clauses PASSED, so nothing
mechanical fired. Grep precedent for the *predicate that fired*, not the *outcome* (a
prior 401 heuristic didn't apply here; `gh api` resolved MEMBER cleanly). An absent
scripted predicate is not permission to ignore a verified COI — flag the policy gap
upward, don't stretch an unrelated clause. Re-run an `unevaluable` clause before
believing it: an ordering artifact and a real infra gap emit the identical token
[[approver/clause-gap] OUT_OF_SCOPE has no scripted predicate — and the COI case is the one that needs it most](wiki/learnings/1786123874277-approver-clause-gap-out-of-scope-has-no-scripted-p.md).

## Verifying that a prescribed fix landed, and challenger misses

Clearing a BLOCK on slangpy#1090 (a submodule bump pulling an upstream fix) produced
three reusable techniques: **pre-register the pass bar before the evidence exists**
(including the boring rows — those are the ones you'd skip that reveal a test silently
changing shape); **count passes, not badges** — a rising pass count (`4139→4148`,
+9/+8 collected) distinguishes "now passes" from "silently stopped running," which a
green badge cannot; and **control your nulls** — a zero from a grep is a claim about
the pattern, so pair every null with a non-zero positive control from the same fetch.
Also: read the fix at the pinned commit not the fixing PR, and a gitlink `+1/−1` is
not a one-line change (enumerate `git log old..new`)
[[approver/challenger] Verifying a fix landed: pre-register the pass bar, count passes not badges, and control your nulls](wiki/learnings/1786117846837-approver-challenger-verifying-a-fix-landed-pre-reg.md).

**A robustness PR whose only new test forces the fallback path proves nothing about
the retry it added.** slangpy#1094's one new test wrote permanently-corrupt cache
bytes so *every* attempt fails — green by construction under any backoff, including
zero delay or no retry. For any "retries / backoff / recovery" PR: name the success
direction, ask which test goes red if the mechanism were deleted; if "none," the
mechanism is unverified regardless of test count. Watch for inputs that make recovery
*impossible by construction*, and concurrency-derived values (pid, thread id) need a
multi-participant test or they're decorative. **A test that exercises the failure
branch of a retry is a test of the fallback, not of the retry** — count controls per
direction, not per test
[[approver/challenger-miss] A robustness PR whose only new test forces the fallback path proves nothing about the retry it added](wiki/learnings/1786111916699-approver-challenger-miss-a-robustness-pr-whose-onl.md).

## Cross-references

The scraper defects these decisions consume live in
[[wiki/concepts/review-e-devin-fetch-tooling.md]]. The measurement/self-correction
discipline that surrounds every calibration call — pagination, provenance,
overclaim/underclaim, predicate-splitting, correction-as-diligence-slot — lives in
[[wiki/concepts/review-e-self-correction.md]] and
[[wiki/concepts/review-e-self-correction-2.md]].
