---
title: "PR review practices — pipeline recovery, convergence, CI-per-revision, dedup, reading GitHub review state"
type: concept
group: review
tags: [pr-review, reviewer-pipeline, convergence, staleness, ci-verdict, dedup, github-reviews, report-audit]
source_count: 11
---

## TL;DR

Practices for running and reading a multi-reviewer PR-review pipeline (Reviewer A =
correctness, B = Devin, C = clarity) and the GitHub review surface.

- **Every leg of the review pipeline can degrade toward "clean" in one run** — recover A/C
  from `stream.jsonl` and the `Write` payload; never count a timed-out Devin as no-findings.
- **A guard can be false in *both* directions** — verify its claim (`REVIEW-GUARD FAIL: zero
  subagent dispatches — no reviewers ran` was false while 7 ran and produced a 16.8 KB review).
- **N independent reviewers agreeing measures shared priors, not currency.** Re-site each
  *claim* (not each report) against the tree as it is *now*; their staleness is perfectly
  correlated because they read the same diff.
- **A CI verdict belongs to a REVISION, not an interval.** Two individually-true numbers
  (green now, N reviewers) can compose into a false escalation.
- **A DISMISSED review erases the CHANGES_REQUESTED it used to be** — join the timeline to
  recover the original state, or metrics under-report exactly the costliest PRs.
- **Dedup on the artifact's own literal string, and drop `in:body`** — issue-search hits live
  in review-comment and diff surfaces `--jq .body` can't see.
- **Vetting must scale with stakes, not source** — an artifact that corrects you (or an
  external review comment) gets the *same* review as your own draft, especially right after
  you've been humbled.
- **Your status report is as unaudited as your code** — run the critique on the report too.
- **A technically-correct PR can die on language-design disagreement** — "closed" ≠ "wrong
  code"; don't pick a side between two CODEOWNERS.
- **When the claim is about a specific property, read the artifact carrying that property** —
  never the aggregate pass/fail of a process that checks twenty other things.

---

## Pipeline recovery: every leg can fail toward "clean"

On slang#12382, **all three review legs degraded in one run**, and each degradation renders
downstream as "no findings":

| reviewer | failure | recovery |
|---|---|---|
| A (correctness) | hit `--max-budget-usd` cap → `error_max_budget_usd`, `final-review.md` absent | 19 KB recovered from `stream.jsonl` |
| C (clarity) | `API Error: Response stalled mid-stream`, `clarity-review.md` = 78 bytes of error text | 11 candidates from the `Write` tool payload |
| B (Devin) | `timeout: did not reach a stable done state within 30m` | none — record as **no signal**, not clean |

**A's guard message ("zero Task/Agent subagent dispatches — no reviewers ran") was false** — 7
subagents ran and 4 returned (verified by counting `subagent_type` keys in `stream.jsonl`); the
guard was detecting its own missing *output file*, not the absence of work. Recovery recipes:
filter `stream.jsonl` for `type=="assistant"` with no `parent_tool_use_id` and keep text blocks
>500 chars (A); scan for `tool_use name=="Write"` on the candidates path *and apply later
`Edit`s* (C). Run dirs are announced in the run's own first lines (`grep` the log for
`output →` / `clarity review:`), not under the log path you passed. Drift checks still run on
recovered runs and must carry a positive control; parse defensively (`message.content` is
sometimes a plain string). **Byte-verify the binary before trusting a test number** — an
untracked scratch `.cpp` was globbed into the build, contaminating results
[All three PR-review reviewers can fail toward "clean" in one run — recover A from stream.jsonl, C from its Write payload, and never count a timed-out Devin as no-findings](wiki/learnings/1785999209399-all-three-pr-review-reviewers-can-fail-toward-clea.md).

The A-guard is false in **both** directions. On slang#12408 it printed *two* failures ("zero
dispatches" and "final review 0 bytes"), both false — a 119-turn run produced a complete 16.8
KB review with 7 dispatches, then hit its budget cap on trailing passes and zeroed
`final-review.md`. **Had the guard been trusted, a real review with 7 findings would report as
"no reviewers ran" — absence reading as clean.** Two recovery traps: **do NOT merge
`tmp/review-candidates/pr-<N>-*.md` as Reviewer C** — Reviewer A runs its own clarity subagent
and writes those into the shared repo root; discriminate by the `Write` payload's `session_id`,
never by file path (the runners share `/workspace/agent/slang/tmp/`). And **gate the drift
check on the command's *method* (`--method POST|PUT|PATCH|DELETE`), not substrings** — read-only
`gh api … compare/commits/pulls` GETs falsely flagged as writes; carry a positive control on a
synthetic POST so 0 means "clean" not "detector broken"
[Reviewer-A guard can be false in BOTH directions — recover from stream.jsonl, and never merge A's clarity candidates as Reviewer C](wiki/learnings/1786044602672-reviewer-a-guard-can-be-false-in-both-directions-r.md).

## N reviewers agreeing measures shared priors, not currency

When multiple independent reviewers converge on a finding, that raises confidence in the
*mechanism* and says **nothing** about whether it is still true of the current code — if they
read the same diff, their independence is real and their staleness is *perfectly correlated*.
On slang#12382, four reviewers (security, code-quality, correctness, clarity) converged
(confidence 87/88/90/high) on a `SLANG_ASSUME`/`-Wassume` build-risk — all correct, all stale:
they reviewed a head where the line was `SLANG_ASSERT`, but a prior commit had already switched
it to `SLANG_RELEASE_ASSERT` (which always evaluates its operand). The hazard was real then,
discharged by the macro switch, and carried forward as an argument where it no longer applied —
coming within one edit of a maintainer-facing PR description.

**Re-site each CLAIM, not each REPORT** (accepting a consolidated report wholesale propagates
its stale half; rejecting it drops its live half — the item split cleanly into "hoist the call"
= live and "warning hazard" = dead). Before acting on a finding whose cited head ≠ current
head: `gh api …/compare/<reviewed>...<current>` and check whether the cited lines fall inside
that diff. **Ask of every convergent finding: what single input did all these reviewers share?
That input is the unaudited part.** A retracted claim in a commit message is worth an amend,
not a follow-up commit [N independent reviewers agreeing measures shared priors, not currency — re-derive each claim against the tree as it is NOW](wiki/learnings/1785999893139-n-independent-reviewers-agreeing-measures-shared-p.md).

## A CI verdict belongs to a REVISION, not an interval

A dispatch asked for a maintainer-nudge: "open, non-draft, green (43/44) for ~3 weeks with 0
approvals." Both numbers were true; the conjunction was false and inverted the conclusion. The
`43 success/1 skipped` census was on the *current* head (pushed the day before); the head
current for the interval censused `41 success / 2 FAILURE / 1 skipped` — a sanitizer job that
stood for **19.8 of the 21 days**. The PR went green ~28 hours before the dispatch, not 3
weeks. **For 19.8 days a reviewer opening that PR saw a failing job — reviewer silence on a red
PR is expected behaviour, not neglect.** The briefed text would have put a false interval on a
human's PR while implicitly criticising two maintainers who'd done nothing wrong. Checks:
census CI **per HEAD SHA**, not per PR; check for re-runs (duplicate check names on one SHA)
before concluding a failure persisted; derive "green since" from `max(completed_at)` on the
current head, never from PR age. **When a claim pairs a *status* with a *duration*, verify they
describe the same object** — a second instance (PR #12155, "0 reviews since 07-18" true but the
PR never left draft, so review was never solicited) shows the same defect
[A CI verdict belongs to a REVISION, not to an interval - check what a reviewer saw DURING the wait](wiki/learnings/1786041756766-a-ci-verdict-belongs-to-a-revision-not-to-an-inter.md).

The general form: **when the claim is about a specific property, read the artifact that carries
that property — never the aggregate status of a process that also checks twenty other things.**
On slang#12413 a fixture was run against a pre-fix binary and reported "FAILED ✓ discriminates"
— but the failure was `Exhaustive check failed: Found 2 diagnostic(s) without annotations` (an
artifact of a moved `//CHECK`), unrelated to the property; asking what the binary actually
*named* gave the opposite answer, and the proposed change would have made the test vacuous.
**A confirming-direction failure short-circuits the "could this have returned anything else?"
reflex that an absence at least prompts.** Both participants nearly accepted the other's wrong
result — one deferring to a track record, the other to a neatly-formatted pass/fail table:
**formatting confers unearned credibility exactly like a track record does.** All six errors in
that review were caught by *measurement*, none by argument — keep the cheap local artifacts (a
preserved pre-fix binary, a worktree at the PR head); they are the only thing that reliably
settles a disagreement between two confident readers. Record the load-bearing precondition *in
the test file*, or a future editor tidying declaration order restores the vacuous case with
every arm green [A confirming-direction failure from the wrong cause — read the artifact carrying the property, not the harness verdict](wiki/learnings/1786069105352-a-confirming-direction-failure-from-the-wrong-caus.md).

## Reading GitHub review state

**A DISMISSED review erases the CHANGES_REQUESTED it used to be.** When a review is dismissed,
GitHub rewrites `state` in place on `pulls/{n}/reviews`; the original verdict survives only in
the timeline (`review_dismissed` events). Any metric counting review cost from the reviews
endpoint under-reports *exactly the costliest PRs* — a reviewer requested changes, the author
fixed it, the reviewer dismissed as a courtesy, and it reads as *no friction*. Measured on a
200-PR census: 2 of 28 dismissals were originally `changes_requested` (a 29% undercount of CR
events), and the erasure flatters bot-authored PRs. Join the timeline to recover the original
state, or count a DISMISSED review as feedback (strictly closer than 0). PENDING genuinely is
not submitted; a DISMISSED-only PR still lands in the *reviewed* bucket at zero cost — the worst
of both denominators [A GitHub DISMISSED review erases the CHANGES_REQUESTED it used to be](wiki/learnings/1786025962656-a-github-dismissed-review-erases-the-changes-reque.md).

**Dedup on the artifact's own literal string, and drop the `in:body` qualifier.** A
"pre-existing, unfiled" HLSL crash was reported (and a parent tier independently agreed) — both
wrong: searching the crash's *own diagnostic text* (`"Unsupported cooperative vector component
type for HLSL emission"`) found PR #10723, where a review comment had predicted the exact crash
and named the fix, merged with zero replies four months earlier. Every *paraphrase* missed it
because nobody who discussed the defect used those words — they quoted the compiler's. The
sharper correction: the real miss was the **`in:body` qualifier**, not vocabulary — `in:body`
excludes issue-level *and* inline review comments; run unscoped or `in:comments`. **When a hit
is expected but absent, flip the cheap structural axis (qualifier/scope/surface) BEFORE
rewriting content.** A GitHub issue-search hit can live in `pulls/{n}/comments` (inline review
comments) or the *diff*, surfaces `--jq .body` cannot see — don't conclude a hit is spurious
because the body lacks the term. Reading the found comment (rather than dismissing it by
`state: closed`) corrected the finding's *magnitude*: three types crashed, not one, reframing a
"fresh discovery" into a "dropped review finding" — materially different to tell a maintainer.
And **two tiers agreeing is not two measurements when both chose the aperture the same way**
[Dedup on a crash's own diagnostic string, not your paraphrase of it — and check PR review comments, a third noun beyond body and comments](wiki/learnings/1786050616503-dedup-on-a-crash-s-own-diagnostic-string-not-your-.md).

## Vetting scales with stakes, not source

Having found a dropped pre-merge review comment (a genuinely valuable find), the reviewer then
**quoted its central claim approvingly one paragraph after its own measurement had refuted it**
— the comment said a `SLANG_RELEASE_ASSERT` made a diagnostic "unreachable," while the measured
cell two sentences earlier showed it *is* emitted. Cause: finding the artifact *was* the win,
and after rounds of being corrected, an external review comment felt like solid ground — so it
was vetted by **source** rather than **stakes**. **The usual failure is over-trusting your own
frame; this is over-trusting the thing that broke it — the same aperture failure with the
polarity flipped, firing precisely when you've just been humbled.** That comment needed three
corrections before its code was usable (overstated severity, non-transplantable control flow,
overreaching guard). **A correct finding and a correct remedy are independent** — don't write
"reuse this rather than re-derive it" until you've compiled the reuse; **prefer the structural
argument** ("its signature cannot express that") **over the implementation-level one** ("it has
no such code path") since the latter expires on a refactor. And **audit a closing tally like a
finding** — a symmetry count ("you corrected me once, I three times") was wrong; two of the
three came from an independent critique tool before the peer replied
[Vetting must scale with stakes, not with source — an artifact that corrects you deserves the same review as your own draft](wiki/learnings/1786052601402-vetting-must-scale-with-stakes-not-with-source-an-.md).

The same discipline turned inward: **your status report is as unaudited as your code.** An
OUTPUT_REVIEW run on a *status report* (not just the code and public comment) found five real
defects: a wrong diffstat typed from memory; a false "comment-only delta" label; a "delta"
asserting ancestry that didn't exist (amended SHAs are *siblings*, not ancestors); broad-suite
numbers with **no retained log** (a number you cannot produce a log for is not a measurement);
and an approval attached to the wrong artifact (approvals are per-artifact, don't transfer). The
one that matters most: the carry-forward-mislabelling rule had been *recorded as a durable
lesson earlier in the same task*, then committed hours later on a different artifact — **writing
a lesson down does not inoculate you, because the second instance doesn't look like the first.**
The remedy that worked wasn't better equivalence reasoning — it was *re-measuring* (rerunning
the suites at the final SHA), which removed the claim entirely. Reports escape scrutiny because
they ship last, when the numbers feel remembered rather than looked up — and the report *is* the
supervisor's only window into the work [Your status report is as unaudited as your code — run the critique on the report, not just the artifacts](wiki/learnings/1786033775232-your-status-report-is-as-unaudited-as-your-code-ru.md).

## Record-facts, and PRs that die on design

**Record-facts (who said what, when) need timestamps and the primary artifact — they're the
claims reviewers wave through.** Repo-facts (commit containment, CI counts) get checked
reflexively; "who instructed X" feels like *recall* rather than a *claim*. On slangpy#1092, a
public correction of an implementer for "misattributing" a version choice was doubly wrong: the
memo actually *recommended* a different value, and the decisive check was a timestamp — the
commit was authored ~76 minutes *before* the message that supposedly instructed it, so **a
commit cannot be instructed by a message that postdates it.** Before publishing any
who-said-what claim, open the artifact and quote it (produce a message id or file:line), order
events by timestamp, and when someone disputes an attribution *and* positive-controls their own
search, that outranks your memory. **Mutual agreement on a fact neither party measured adds zero
evidence while feeling exactly like verification** — a parent "verified" the false claim while
owning the refuting document in its own inbox for ~19 hours. Reviewer heuristic: find the claim
that is *not* of the type you habitually check, and check that one
[Record-facts (who said what, when) need timestamps and the primary artifact — they're the claims reviewers wave through](wiki/learnings/1786025583315-record-facts-who-said-what-when-need-timestamps-an.md).

**A technically-correct PR can die on language-design disagreement — don't read "closed" as
"wrong code."** slang PR #12269 (a 3-line parser fix for a real segfault) was closed unmerged
with *zero* code faults found — internal APPROVE_WITH_NITS, Devin 0/0/0, codex all-approve, and
the maintainer who *proposed* the approach defending it to the end. It died because a second
CODEOWNER wanted a different language design. **When two CODEOWNERS disagree on design, don't
pick a side and don't nudge** — post at most one strictly-factual, non-advocating comment with
decision-relevant evidence, then hold; the chain is blocked on *their* convergence.
**Verify the other side's empirical claims — it can strengthen your position** (testing showed
the fix was the *general* cure for three more crashing forms). **On close-unmerged, do NOT
delete the branch/worktree or reopen** — closed-on-design ≠ wrong work, the underlying issue
stayed open, so preserve the patch and let maintainers own the reopen decision
[A technically-correct PR can die on language-design disagreement — don't read "closed" as "wrong code"](wiki/learnings/1786008473137-a-technically-correct-pr-can-die-on-language-desig.md).

## See also

Instrument controls (false zeros, census, guards, markdown-grep) underpinning these practices:
[[wiki/concepts/review-c-instrument-controls.md]]. The approver-specific decision procedure:
[[wiki/concepts/review-c-approver-decision-procedure.md]]. Learnings-store title/index mechanics
that a review write-up must respect: [[wiki/concepts/review-c-store-hygiene.md]].
