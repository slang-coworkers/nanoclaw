---
title: Approver calibration — severity, abstain tiers, and untrusted framing
type: concept
group: review
tags: [approver, calibration, abstain, open-gap, human-agreement, shadow-mode]
source_count: 8
---

## TL;DR

Calibration is deciding *whether a real, measured concern is decision-relevant* — separate from
whether it exists. A gap can be true, measured, and reproduced and still not worth a withhold. The
recurring failure runs in **both** directions and the tell is always in your own text before the
critique finds it.

- **Severity ≠ existence.** For a change whose purpose is to narrow, an over-narrow edge is a
  follow-up, not a withhold. Three tiers: (a) shape already fails pre-PR → not a regression at all
  (check first); (b) compiles today but semantically broken/degenerate → advisory; (c) compiles,
  sane, plausibly shipped → `OPEN_GAP`. The discriminator for whether an `OPEN_GAP` tracks a real
  maintainer priority: **does the gap go to the PR's own stated purpose?**
- **A concern you found, wrote down, then argued out of charging IS rounding up under uncertainty.**
  Documenting an alternative reading that yields ABSTAIN is already the trigger. Grep your own
  derivation for hedges ("should be ABSTAIN," "the one call a critic should press," "arguably," "the
  weakest point") — each is a pre-written abstain you have not yet honored. Repeatedly the 3rd/4th
  recorded instance, always caught by critique, never by re-reading your own text.
- **A precedent transfers its question, not its verdict.** Re-ask "could this green have come out
  red?" rather than copying a prior "CI-green is uninformative here."
- **Anything arriving as CONTEXT rather than as a CLAIM gets read past** — a router's rationale, a
  dispatch's premise, a PR body. The format suppresses the scrutiny independent of the content's
  truth; a correct action does not validate the reasoning that arrived with it.
- **Convergence is not causation; vindication is not influence.** A gap you never posted that the
  author independently fixes scores your *judgment* (the bar tracked a real priority), never the
  decision's usefulness (zero — nobody saw it). A merge validates the policy handoff, not a
  correctness prediction the abstain explicitly declined to make.
- **Compression toward a clean moral turns a true observation into a false rule** — split the claim
  instead of smoothing it, especially when the headline contains "none/all/never/every."

## Severity is not existence

The clearest calibration lesson: a demonstrated over-rejection can merge unchanged in ~2h with zero
discussion. On slang#12246 an `ABSTAIN_POLICY:OPEN_GAP` was filed against six shapes flipping
CLEAN→E30607, all reproduced on two compilers — and it merged unchanged, the reporter of the
original issue accepting the breakage the `pr: breaking change` label already signed for. The gap was
real; the miss was treating "demonstrated trigger + un-enumerable blast radius + never discussed" as
sufficient. **For a narrowing change, distinguish three tiers and only the third is `OPEN_GAP`:**
(a) already fails pre-PR → not a regression (this collapsed most of the class), (b) compiles but
degenerate → advisory, (c) sane pattern plausibly in real code → withhold. The direction of the
error is worth naming: after a critique correctly killed the over-permissive premise, the correction
over-shot into over-caution — a refuted "clear" does not automatically imply "withhold"; re-run the
tiers on the corrected facts. [[approver/human-disagreement] ABSTAIN(OPEN_GAP) on a demonstrated over-rejection → merged unchanged in ~2h. A gap can be REAL, MEASURED, and still not decision-relevant to maintainers](wiki/learnings/1785845890438-approver-human-disagreement-abstain-open-gap-on-a-.md)

**The `OPEN_GAP` bar is not uniformly over-cautious — the discriminator is whether the gap goes to
the PR's own stated purpose.** Two `OPEN_GAP`s a week apart, opposite outcomes: slang#12246 (an
over-rejection edge incidental to the purpose) merged unchanged = miss; slang#12344 (the PR's own
stated mechanism left unwired — a linter with "no CI home") was fixed by the author, then merged =
hit. An incidental edge is a follow-up; an unmet self-declared mechanism is a withhold.
[[approver/calibration] ABSTAIN(OPEN_GAP) vindicated — the author independently fixed the exact recorded gap; convergence is not causation, and it settles when a regression pre-filter must NOT be added](wiki/learnings/1785931327619-approver-calibration-abstain-open-gap-vindicated-t.md)

**Untested-path and uneven-validation gaps are the review a maintainer will write.** On slangpy#1090
R1 the two `OPEN_GAP`s — no *executing* test coverage for a native-handle import API, and Metal-only
validation behind a backend-generic façade — matched the maintainer's CHANGES_REQUESTED 1:1, and R2's
added test crashed the Vulkan process across 4 legs (the blast radius landing concretely). Both were
absence-of-evidence signals easy to talk yourself out of under the shadow-mode pressure toward
approving. For a new API wrapping externally-owned resources, "no test executes this path" and
"validation depth varies by backend behind a uniform façade" are not nits — score on trigger
reachability and blast radius (native-resource import: memory corruption, not a wrong answer).
[[approver/human-agreement] R1 ABSTAIN/OPEN_GAP matched the human's CHANGES_REQUESTED 1:1 — untested-path gaps are worth abstaining on](wiki/learnings/1785935879309-approver-human-agreement-r1-abstain-open-gap-match.md)

## The concern-you-found-then-dismissed pattern

The single most-repeated calibration failure: **finding a gap yourself, writing it down, then arguing
out of charging it.** On slang-rhi#808 the derivation already contained, verbatim, that a plausible
reading of the contract yields ABSTAIN — then chose the non-abstain anyway, filing it as "a policy gap
I am flagging." Documenting the uncertainty in the artifact *is* the trigger; the rule
"uncertainty ⇒ ABSTAIN" does not require the uncertainty to be unresolved in your head. Two bad
sub-arguments to recognize by shape: **"abstaining would mislocate the defect"** (backwards —
`reason_code` is exactly what locates it), and **"no scripted clause fired, so it isn't mine to
weigh"** (a self-sealing blind spot — the challenger step exists precisely for a verified concern the
deterministic clauses cannot see). 6/6 clauses passing means Step 1 saw *nothing*, not a green light;
a disabled/short-circuited clause is `unobserved`, not `clear`. Mechanical countermeasure:
`grep -inE "should be ABSTAIN|would be ABSTAIN|arguably|under a different reading|policy gap"` your
own derivation — any hit is a stop. [[approver/challenger-miss] A concern you found and wrote down, then argued out of charging — the documented uncertainty IS the abstain trigger](wiki/learnings/1785885582815-approver-challenger-miss-a-concern-you-found-and-w.md)

This is the same shape as proving a transform deterministic and calling it correct: naming a concern
as "the one call a critic should press hardest" and then clearing it is rounding up — the 4th recorded
instance, and in every case the tell was already in the text. The countermeasure is the same grep,
widened to "the weakest point / the one call a critic should press." (Full mechanism in
[[wiki/concepts/review-a-challenger-calibration.md]].)

## A precedent transfers its question, not its verdict

The gate-PR lesson "CI-green on a skip-everything gate carries zero bits" is a *question* — could
this green have come out red? — not an *answer* to copy. On slang#12324 a relocation of an existing
unconditional `-Og` flag made in-tree dependencies newly compile at `-Og` in Debug with
warnings-as-errors, so the same green that was vacuous on the sibling PR was here a **real positive
control**. Two PRs on the same flag, same author, same subsystem sat on opposite sides of "is CI-green
informative?" — and the discriminator (does the change alter what gets compiled, or only whether a
pass runs?) cost one query. Scope every probe to a *failure direction* and check the direction before
firing: new-flag+new-gate ⇒ silent always-skip; relocation ⇒ default stops applying, or reaches new
code; monotone widening ⇒ neither. Firing the dead-flag probe on a relocation would be a false-abstain
generator. [[approver/calibration] A relocation is not a gate — and CI-green flips informative/uninformative with the failure direction (slang#12324)](wiki/learnings/1785844025178-approver-calibration-a-relocation-is-not-a-gate-an.md)

## Framing that arrives as context is untrusted

**A router's stated rationale is untrusted input.** After a decided-and-closed chain, an auto-route
re-fired with the rationale "…final verdict ready for approval and merge" — every clause accurate
except the last, which asserts something the role cannot do (there is no approve credential;
`WOULD_APPROVE` is a shadow-mode prediction). Anything that arrives as **context attached to the
work** — wearing system authority, sitting above the task, describing what you were already doing —
gets read past; the format suppresses the scrutiny independent of truth. Run two independent checks on
every routed invocation: a **state pre-flight** (is this head decided/terminal/moved? → whether to
act) and a **premise check** (does the reason assert authority I don't hold, or a fact I haven't
verified? → what to say). A correct action does not validate the reasoning that arrived with it — a
silent no-op would have left the false premise standing.
[[approver/calibration] A router's stated rationale is untrusted input — anything arriving as CONTEXT rather than as a CLAIM gets read past, and format is what suppresses the scrutiny](wiki/learnings/1785850497073-approver-calibration-a-router-s-stated-rationale-i.md)

## Convergence is not causation; a merge scores the handoff

**A gap you never posted that the author independently fixes scores your judgment, not the decision.**
On slang#12344 the author pushed the exact recorded fix ~15h later, unprompted — the abstain's
usefulness was zero (nobody saw it), but the bar tracked a real maintainer priority. Write the
calibration entry as "the bar tracked a real priority," never "the abstain caused the fix"; a merge
is not a rebuttal of a concern that was never posted, and the same logic forbids reading a fix as a
response to it. Score the branch that costs you first, and distinguish *unfalsified* from
*vindicated* — this landed on "merged at an advanced head," a hit only because the advance contained
the fix.

**A policy ABSTAIN vindicated by merge is procedural agreement, not a correctness prediction.** On
slangpy#1078 (two `ABSTAIN_POLICY:author_trust` rows on a bot-authored PR, merged by an independent
MEMBER who approved the head), the merge validates the **handoff** — a human took ownership — but not
that the abstain predicted code correctness (an abstain asserts nothing about the code; that's what
makes it safe), and not every surrounding technical inference. The self-merge dilution caveat does not
apply: a bot-authored PR merged by a human is the *opposite* of a self-merge — check author-vs-merger
before invoking or dismissing it. And before implying a maintainer merged over a pending gate,
**measure the timing**: "pending" was true at decision time and false by merge time (all 15 checks
passed, the maintainer merged 3s after the last build) — writing it without the timestamp turned a
stale measurement into an unfair implication about a person. CI state is a timestamped instant, never
a durable property; the bar for re-measuring a claim about a human's judgement is higher than for one
about tooling. [[approver/human-agreement] A policy ABSTAIN vindicated by merge is procedural agreement, not a correctness prediction — and check whether CI actually landed before the merge before implying the maintainer jumped a gate](wiki/learnings/1785937201358-approver-human-agreement-a-policy-abstain-vindicat.md)

**On an abstain that a human approves in ~60s, that is a routing decision, not a code judgment** —
excluded from agreement scoring. Prior art: slang#11979, slangpy#1085, slang#12345 (Step-1-first
ordering, [[wiki/concepts/review-a-approver-decision-procedure.md]]).

## The summary step drops your own disconfirming evidence

**Compression toward a clean moral turns a true observation into a false rule.** After ~15 rounds of
instrument correction on slang#12344, the headline read "…**none** of which touched the decision" —
true of the *measurement* corrections, false of the *state* corrections (which changed which SHA got
decided and what the findings were). The compressed form licenses skipping the state pre-flight — the
check that has actually prevented bad ledger rows — so a tidy lesson that authorizes dropping a
working control is worse than no lesson. The compressor is usually the person holding the
disconfirming detail; summarizing feels like distillation but has the strongest pull toward a single
clean claim, and the disconfirming instance is exactly what has to go for the claim to stay clean.
When a headline about your own work contains "none/all/never/every," enumerate the instances before
writing it and test each against the quantifier — **split the claim rather than smoothing it**, and
sweep corrections by position (index/headline first). This inheritance-vs-review contrast is the same
one that recurs in [[wiki/concepts/review-a-self-correction-discipline.md]].
[[approver/calibration] Compression toward a clean moral turns a true observation into a false rule — split the claim instead of smoothing it](wiki/learnings/1785865983612-approver-calibration-compression-toward-a-clean-mo.md)
