---
title: Adjudicating reviewer findings — severity is a claim to audit, verify against source
type: concept
group: review-process
tags: [severity-audit, hedged-wording, false-positive, consuming-code, convergence, universal-claim, typed-vs-computed, approver, reviewer]
source_count: 12
---

## TL;DR

A reviewer's finding — its severity marker, its mechanism, its "resolved" trailer,
its count — is **upstream metadata authored by a fallible party, not a verdict to
inherit**. The evidence is the artifact. Every atom here is a way a plausible-
sounding finding was wrong, or a way the adjudicator's own claim was wrong, and the
discipline that settles it.

- **Severity is cheap to over-set; the wording is where confidence leaks.** A 🔴
  whose fix is "add a comment / should be documented or asserted" is a hedged
  hypothesis wearing a bug's marker. Demonstrated (names the wrong output / a
  failing test) → verify and BLOCK; hedged ("may", "could", "assumes X") → open the
  cited file:line and settle from source. It fails both ways: a hedged 🔴 manufactures
  a BLOCK; a confident 🟡 hides something worse.
- **Adjudicate against the CONSUMING code, not the label.** When two sources
  disagree on severity for the same location, trace what the flagged write actually
  feeds. If it reaches only a log/summary string and never the pass/fail counters,
  exit code, or recorded result, it is at most a nit.
- **A "resolved" / "Addressed in commits X to Y" marker is a CLAIM, not a fix** —
  re-read the cited lines at the pinned head; the strongest-looking evidence (a bot
  saying its own finding is fixed) is the one nobody re-opens.
- **A finding aimed AT the change under review needs the most scrutiny, not the
  least** — clearing it restores a conclusion you already hold. "The only trigger is
  X" and "nothing exercises X" are **universal claims** requiring enumeration, not
  intuition (grep the spawn site / the public teardown API, not the workflow YAML).
- **Verify at YOUR layer, with runtime operands.** A mechanism true at LOWER-TO-IR
  can be dead by emit; constant folding hides opcode probes.
- **Classify from the RAW comment body**, never a WebFetch/summarizer paraphrase —
  a lossy instrument can invent the exact claim you then "refute".
- **Numbers and totalizers are claims: compute them, don't type them.** Convergence
  of multiple reviewers raises confidence in the code-SHAPE observation, not in the
  end-to-end impact.

## Severity, wording, and the consuming code

Step 2 of the approver procedure is mechanical ("any 🔴 Bug ⇒ BLOCK"), which makes a
mis-set marker load-bearing. On slang#12459 a crashed review's `code-quality-reviewer`
labelled a **bug** ("may use stale union type after `replaceUsesWith`"), but its own
remediation — "should be documented or asserted" — gave it away: "a reviewer that had
proven a miscompile would describe the wrong output, not request a comment". Checked
against source, a value's type lives in a real `IRUse`, so `replaceUsesWith` rewrites
it; the read was not stale. **Hedged wording is the tell** — "may / could / assumes X
which should be documented" is a hypothesis with a severity marker attached; open the
file:line and settle it, because "the severity label is cheap for a reviewer to
over-set; the wording is where its actual confidence leaks" [a reviewer's 🔴 severity is a claim to audit, not a verdict to inherit — hedged wording is the tell](../learnings/1786455562285-approver-challenger-miss-a-reviewer-s-severity-is-.md).

The tie-breaker when two sources disagree is the **consuming code**. On slang#12471
Devin returned a 🔴 at `slang-test-main.cpp:1447` while the production review rated the
same region a 🔵; tracing the consumer, the flagged `recordTestServerLoss()` touches
only `m_testServerLossCount`, which feeds a warning `printf`, never `didAllSucceed()`
/ `m_failedTestCount` / the exit code — "a finding that doesn't reach one of the
load-bearing sinks cannot be a 🔴 regardless of the emoji", and Devin "calibrates hot
on diagnostic wording" [Devin over-severities a diagnostic mislabel to 🔴 — adjudicate against the consuming code](../learnings/1786462381178-approver-challenger-miss-devin-over-severities-a-d.md).
The same discipline applied to an "assert-disabled-in-release ⇒ UB" claim on
slang#12501: run TWO probes — is the asserted value on the value path (here the
recursion passes `superType`, not the asserted `w->getSup()`, so a false assume
changes nothing), and does the invariant hold by construction (the producer builds
the two sides equal). "Only if BOTH the value depends on the assert AND the invariant
is reachably violable is it a real defect" — and a rule that condemned this idiom
would condemn thousands of existing `SLANG_ASSERT`s [Devin "assert-skipped-in-release = UB" needs the value-path check, not just the macro fact](../learnings/1786562763950-approver-challenger-miss-devin-assert-skipped-in-r.md).

## Resolved markers, and findings aimed at the fix

A CodeRabbit thread trailer "✅ Addressed in commits 2b9240b to c73384e" is emitted
whenever new commits land in the covering range — "a statement that the file changed,
not a verification that the specific defect was fixed". On slang#12439 neither of two
🟠 Major threads was actually addressed at head (`--slangc` still `required=True`
before the `--prepare` short-circuit). "This compounds with a second effect: a
resolved thread disappears from the reviewer's default reading surface, so the claim
is never re-tested — the strongest-looking evidence is the one nobody re-opens." Fetch
resolved threads and **read them anyway**; the clearing of a finding needs the same
evidence standard as the raising of one: a citation to code read at the decision
commit [a bot review thread marked "✅ Addressed" is a CLAIM, not a fix — re-read at the pinned head](../learnings/1786455744147-approver-challenger-miss-a-bot-review-thread-marke.md).

A finding whose target is the **change under review** is the one you can least afford
to clear cheaply. On slang-rhi#826 R2 the reviewer's Flag pointed at the fix itself; it
was cleared with "its only plausible trigger is process exit" — but `destroyRHI()` is
documented public API whose teardown re-runs the exact unload/reload the PR existed to
prevent. Two compounding errors: **structural** (having just proven the fix resolved
your own finding, clearing an objection to it feels like continuity, not laxity —
"that is precisely the condition under which a flag aimed at the fix needs the most
scrutiny, it is the only finding that can undo the conclusion you already reached"),
and **logical** ("the only trigger is X" is a universal claim over a surface never
enumerated — "only / never / no other" are quantifiers requiring a grep of the public
entry points). The transferable rule: **credit does not carry forward** — "the author
fixed my last finding" is no evidence about the next objection [a review flag pointing AT the fix is the one you can least afford to clear cheaply — "only trigger is X" is a universal claim](../learnings/1786412526626-approver-challenger-miss-a-review-flag-pointing-at.md).

The universal-claim trap recurs as coverage assertions. On slang#12136 "all 48 green
check-runs are structurally incapable of seeing it — none exercises `slangd`" was
false: a test driver (`test-context.cpp`) spawns `slangd` for every `//TEST:LANG_SERVER`
directive (57 across 79 files). "I censused `.github/workflows/` mentions and read that
as a census of execution — a binary invoked through a test driver never appears in
workflow YAML." State coverage gaps as **"entry point E has no test", never "binary B
never runs"** — and the danger is that the verdict survived the corrected premise, so
nothing prompts a re-check while the *actionable part* (routing a maintainer to build a
lane that already exists) was the wrong part [ "Nothing exercises X" is a claim about the TEST HARNESS — grep the spawn site, not the workflow YAML](../learnings/1786401954156-approver-challenger-miss-nothing-exercises-x-is-a-.md).

## Verify at your layer; convergence is not impact

A reviewer's mechanism can be **mechanically well-argued and dead by the time it
reaches your layer**. On a SPIR-V arithmetic-classifier fix, codex's SHOULD-FIX
("`no_diff int` lowers to `Attributed(Int,NoDiff)`, unwrap flips the opcode") had every
premise true in isolation but was refuted by counting `Attributed(Int` in the *final*
IR dump (0 hits where it mattered vs 145 across the whole dump): "an attributed type
existing in the IR does not mean it exists at YOUR pass — count it in the final dump
section, not the first". Also: **constant folding is a plausible-negative for opcode
probes** (literal operands make the instruction vanish, reading identically to "the
opcode is fine" — force runtime values); `-dump-ir` goes to **stderr**; and a refuted
finding still needs a positive control (the *pre-fix* binary showing the signed
opcodes) [a reviewer's plausible mechanism can be dead by the time it reaches your layer — check the FINAL IR](../learnings/1786385209770-a-reviewer-s-plausible-mechanism-can-be-dead-by-th.md).

**Reviewer convergence raises confidence in the code-SHAPE, not the end-to-end
impact.** On slang#12518 three sub-reviewers converged on a headline 🟡 (a single-level
`as<IRFunc>` unwrap drops generic-dispatched helpers) — the code-shape reading was
locally correct, but the posited failure path never reaches emit (the test uses a
non-generic helper; the walker runs after concrete generics collapse to bare IRFunc;
the `{}` empty-existential folds to poison before emit). "'Would mishandle shape X' ≠
'shape X reaches this pass' ≠ 'produces a wrong final artifact' — verify the
pass-ordering crux and the lowering fate before headlining", and this repo rejects
speculative defensive fixes without a failing-test repro [three-reviewer-convergent generic-dispatch "gap" was REFUTED end-to-end](../learnings/1786600004939-slang-12518-three-reviewer-convergent-generic-disp.md).

## The evidence is the body, and numbers are computed

Classify a finding from the **raw comment body**, never a paraphrase. On slang-rhi#832
a WebFetch "extract verbatim" prompt fabricated a semantic-inversion claim; the author
then "verified" it as a false positive — refuting a claim CodeRabbit never made. "A
lossy instrument can manufacture the exact claim you then refute, producing a confident
false clear"; re-fetching the RAW bodies via GraphQL `reviewThreads` showed a real
fail-open (🟡 `potential_issue`) and a coverage ask (🔵 `nitpick`) — and the
`cr-indicator-types:` HTML marker (the reviewer's own severity) is in the raw body and
absent from paraphrases. Second lesson: **when a PR introduces a safety invariant,
price a gap by whether it holes THAT invariant, not delta-vs-current-behavior** [CORRECTION — classify a reviewer finding from its RAW body, never a WebFetch/summarizer paraphrase](../learnings/1786482355990-approver-challenger-miss-correction-classify-a-rev.md).

Even a claim about your own open artifact fails if produced by looking rather than
counting. On slang#12464 five factual claims fell (all quantity/totalizer claims typed
not computed) — "opening the artifact is necessary and not sufficient; the claim has to
be produced by a command whose output *is* the claim". The trigger is **grammatical and
mechanical**: a bare number (`33`, `9/9`) or a totalizer (**both / all / every / each /
only / none / no other**) each demands re-derivation with a command; a run-level
`status` is not a statement about its jobs; a matrix job present in one run is not
present in its siblings (enumerate the denominator); and numbers introduced by a
*correction* are the least-audited [five wrong claims in one review, all quantity/totalizer claims typed rather than computed](../learnings/1786428972281-approver-critique-mustfix-five-wrong-claims-in-one.md).
A corpus figure without its scope is uncheckable and is the first thing a reviewer
spot-checks — "61 on 15" was exact only at the four-source scope never stated; and **a
number a reviewer hands you is still an unopened artifact** — adopting a corrector's
figure feels like diligence, which is exactly why it evades the check [a corpus figure without its scope is uncheckable — and a number a reviewer hands you is still an unopened artifact](../learnings/1786410539141-approver-challenger-miss-a-corpus-figure-without-i.md).
Finally, **reviewing a comment's style is not verifying its factual claim**: an
APPROVED code comment asserting a false mechanism (a "phantom/stale bot node id") would
have landed as durable documentation — "any node id, error string, flag, or version
named in a comment is a falsifiable claim with a one-command test; a wrong *why*
committed to source is worse than a wrong commit message" [reviewing a comment's style is not verifying its factual claim](../learnings/1786413091170-reviewing-a-comment-s-style-is-not-verifying-its-f.md).

**Source learnings (12):**

- [a reviewer's plausible mechanism can be dead by the time it reaches your layer — check the FINAL IR](../learnings/1786385209770-a-reviewer-s-plausible-mechanism-can-be-dead-by-th.md) — count the attributed type in the final dump section not the first; constant folding is a plausible-negative; `-dump-ir` goes to stderr; a refuted finding needs a positive control.
- ["Nothing exercises X" is a claim about the TEST HARNESS — grep the spawn site, not the workflow YAML](../learnings/1786401954156-approver-challenger-miss-nothing-exercises-x-is-a-.md) — a driver-spawned binary is invisible in YAML; state gaps as "entry point E has no test"; the verdict survived the wrong premise so nothing prompted a re-check.
- [a corpus figure without its scope is uncheckable — and a number a reviewer hands you is still an unopened artifact](../learnings/1786410539141-approver-challenger-miss-a-corpus-figure-without-i.md) — write the scope in the same sentence as the number; re-derive or attribute a corrector's figure, never silently promote it.
- [a review flag pointing AT the fix is the one you can least afford to clear cheaply — "only trigger is X" is a universal claim](../learnings/1786412526626-approver-challenger-miss-a-review-flag-pointing-at.md) — credit does not carry forward; "only/never/no other" are quantifiers requiring enumeration of public entry points.
- [reviewing a comment's style is not verifying its factual claim](../learnings/1786413091170-reviewing-a-comment-s-style-is-not-verifying-its-f.md) — a code comment is a claim that outlives the diff; identifiers/error strings in a comment are one-command falsifiable; inherited framing is not evidence.
- [five wrong claims in one review, all quantity/totalizer claims typed rather than computed](../learnings/1786428972281-approver-critique-mustfix-five-wrong-claims-in-one.md) — opening the artifact is necessary but not sufficient; a bare number or a totalizer word is an instruction to re-derive with a command; correction-introduced numbers are least audited.
- [a reviewer's 🔴 severity is a claim to audit, not a verdict to inherit — hedged wording is the tell](../learnings/1786455562285-approver-challenger-miss-a-reviewer-s-severity-is-.md) — a 🔴 whose fix is "add a comment" is a documentation finding wearing a bug's marker; it fails both ways.
- [a bot review thread marked "✅ Addressed in commits X to Y" is a CLAIM, not a fix](../learnings/1786455744147-approver-challenger-miss-a-bot-review-thread-marke.md) — the trailer means the file changed, not that the defect was fixed; read resolved threads anyway; clearing needs the same evidence standard as raising.
- [Devin over-severities a diagnostic mislabel to 🔴 — adjudicate against the consuming code, not the label](../learnings/1786462381178-approver-challenger-miss-devin-over-severities-a-d.md) — trace the flagged write to its sink; if it reaches only a log/summary string it is at most a nit; Devin calibrates hot on wording.
- [CORRECTION — classify a reviewer finding from its RAW body, never a WebFetch/summarizer paraphrase](../learnings/1786482355990-approver-challenger-miss-correction-classify-a-rev.md) — a lossy summary can invent the claim you refute; read the `cr-indicator-types:` marker; price a gap against the invariant the PR ADDS. (Supersedes a same-session "functional-correctness inversion" leaf.)
- [Devin "assert-skipped-in-release = UB" needs the value-path check, not just the assert-macro fact](../learnings/1786562763950-approver-challenger-miss-devin-assert-skipped-in-r.md) — two probes: is the asserted value on the value path, and does the invariant hold by construction; else the rule condemns thousands of existing asserts.
- [slang#12518: three-reviewer-convergent generic-dispatch "gap" was REFUTED end-to-end](../learnings/1786600004939-slang-12518-three-reviewer-convergent-generic-disp.md) — convergence confirms the code-shape observation, not the impact; verify the pass-ordering crux and lowering fate; the repo rejects speculative defensive fixes.
