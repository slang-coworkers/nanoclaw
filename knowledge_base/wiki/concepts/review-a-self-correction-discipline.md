---
title: Self-correction discipline — diligence slots, sweeps, and shared-learnings routing
type: concept
group: review
tags: [approver, critique-mustfix, correction, diligence-slots, sweep, shared-learnings, provenance]
source_count: 25
---

## TL;DR

The most dangerous review artifact is the one that *reads as rigor* — a correction, a confession, a
caveat, a novelty claim, or the code written to satisfy your own recommendation. Its framing asserts
that the checking already happened, so it gets the least scrutiny. Almost every error in this family
is **structural observation correct, attributed cause wrong** — and the direction that flatters,
exculpates, or looks more complete is the one that skips the check.

- **Diligence slots** (least-audited artifacts, ranked): a correction *you issue*, a self-accusation,
  an untested REACH claim, a novelty claim, a received correction, a caveat, a forwarded
  verification. The fix for the silent ones is one command: `grep` your own store before writing "new
  rule / I previously retracted X / this proves Y."
- **A retraction is a new claim and inherits no credibility from the error it corrects** — a
  retraction can *be* the error, and it ends at the boundary of what it establishes. After a public
  claim is refuted, retract and stop; do not attach a second theory.
- **Naming a habit does not disarm it — only a mechanical per-surface sweep does.** A rule protects
  you when *executed as a step*, not when written down. Sweep every surface (derivation, ledger
  field, upstream message, memory row, shared learning), and re-grep the file you just edited.
- **Compute the cell, don't infer it** — arithmetic/counterfactuals asserted from eyeballing are
  unrun queries. A right mechanism lends unearned credibility to a wrong frequency/count.
- **`/workspace/shared/` is write-only from an agent tier** — `append_learning` mints a new file, it
  cannot amend an existing note. An extension filed where the claim isn't read is as unreachable as a
  retraction; route it to the tier that can banner the original, and *report the action, not the
  outcome* when you can't read the property back.
- **Audit the change made in response to your own review the hardest** — compliance reads as
  already-validated, and your recommendation was never compiled.

## The diligence slots — least-audited by design

The unifying frame: **a claim whose framing asserts the checking already happened gets the least
scrutiny.** The observed slots, from a single slangpy#925 / slang-rhi#811 chain and its aftermath:

- **A correction you are ISSUING** — the sharpest. Correcting someone supplies the felt authority of
  having checked, especially when the sentence demands rigor ("naming it precisely matters"). A tidy
  correction to a peer's item was a narrowing that the author's own file, written 20 minutes earlier,
  explicitly rejected. [[approver/critique-mustfix] Issuing a correction is the sharpest diligence slot — I demanded precision from a peer while narrowing my own error from recall, one turn after recording the rule against it](wiki/learnings/1785940962451-approver-critique-mustfix-issuing-a-correction-is-.md)
- **A self-accusation / confession** — the least-audited, because nobody (including the author)
  audits a claim whose only victim is the claimant. Two agents competed to accept blame and both
  overshot the facts; a false claim about a *peer's* artifact got written into the *author's* durable
  store, the one place the peer is authoritative and cannot inspect. Treat a confession as a claim;
  prefer the weaker runnable form ("this fact is older than my latest probe — re-check it" is
  executable at ship time; "the proof was sitting in my output" needs a change point you didn't
  have); look for the *logical* disproof before the retrieval one.
  [[approver/critique-mustfix] Self-accusation is a diligence slot — the least-audited one; two agents competed to accept blame and both landed wrong](wiki/learnings/1785941262458-approver-critique-mustfix-self-accusation-is-a-dil.md)
- **An untested REACH claim** ("this probe proves Y") — produces plausible hits, no suspicious zero,
  so no natural error signal; survives days and propagates as cited authority. Only the pessimistic
  direction (an untested LIMIT) trips "a zero-hit needs a positive control" (three-tier mechanism in
  [[wiki/concepts/review-a-approver-decision-procedure.md]]).
- **A novelty claim** ("here's the rule I'm taking from this") — a load-bearing past-tense claim
  about your own store's contents; "a rule I derived" flatters more than "a rule I wrote down and
  didn't apply" (passive-rule section below).

The fix for all the silent ones is the same command:
`grep -ril "<the mechanism / rule / command>" /workspace/shared/learnings/ <own memory store>`. The
reflex: before writing *"new rule," "the rule I'm taking from this,"* or *"I previously
said/retracted X,"* grep. **A well-formed artifact feels finished** — addressee, predicate, evidence
— and the form supplies the felt authority the checking should have.
[[approver/clause-gap] An ASK is a claim about a mechanism's behaviour — run the dead-gate probe on your own proposal before sending it (I proposed a clause whose failure direction cannot fire)](wiki/learnings/1785942491533-approver-clause-gap-an-ask-is-a-claim-about-a-mech.md)

**An ASK is a claim about a mechanism's behaviour and gets the same probe as a PR.** A proposed
`author_declared_ready` clause was well-formed but both limbs were dead: "PR is non-draft" is an
*entry precondition* of the pipeline (a tautology — the workflow only fires on `ready_for_review`),
and "no author comment declaring WIP" is a free-text judgment read that would land a spurious
`ABSTAIN_INFRA` fleet-wide. Run the dead-flag probe on your own proposal: name the input that makes
it FAIL, find a *trigger-present control* (a historical case where it would have changed the
outcome — if your motivating case *passes* the clause, it is not the fix for that case), check entry
preconditions, and check evaluability against the tier's data.

## A retraction is a new claim; a plausible causal story is the most dangerous

**A retraction inherits no credibility from the error it corrects — and can be the error.** Round 1
retracted "a passing retry proves a flake" (correct) but justified it with a new unsupported premise
("`test-falcor` runs on Windows so can't reach a Metal-emit change"); round 2 caught that runner OS ≠
compilation-target coverage. A true conclusion reached by an invalid argument reads as verified, and
the reflex to feel *more* rigorous while correcting yourself is exactly when to re-apply the standard.
A proxy artifact does not inherit the authority of the artifact it replaces (later-run logs pin the
test *input*, not the compiler); "expensive and not done" ≠ "impossible"; a clean merge shows the
code was fine, not that the policy was well-calibrated; and **when you write a rule that says ASK, the
deliverable must contain the question.**
[[approver/critique-mustfix] CORRECTION to my two 2026-08-04 notes — I over-claimed a ledger-clobber mechanism and an "execution proved" transfer; both were cut down at DECISION_REVIEW](wiki/learnings/1785843418724-approver-critique-mustfix-correction-to-my-two-202.md)
[[approver/critique-mustfix] SECOND correction — my replacement for a bad inference was ALSO bad: runner OS does not bound compilation-target coverage, and "ask, don't guess" must actually be ASKED](wiki/learnings/1785844326149-approver-critique-mustfix-second-correction-my-rep.md)

**After a public claim is refuted, retract and stop — do not attach a second theory.** Bot-PR
reviewer routing was misdiagnosed twice: first attributing a project-board comment to the assignment
function, then concluding the bot-owners pool was empty (a `|| ""` fallback said nothing about a
`workflow_call` `inputs:` default). Both were confident, cited real code, verified at the fragment
level — the *conclusion* was never verified. Being right about a refutation creates no standing to
assert what's true instead; when the owner of a system has told you it's misbehaving, the useful
contribution is the retraction, full stop.
[CORRECTION — bot-PR reviewer routing in slang/slang-rhi is a misfire, not deliberate design (and how I got it wrong twice)](wiki/learnings/1785891791274-correction-bot-pr-reviewer-routing-in-slang-slang-.md)

**A plausible causal story disarms the implausibility alarm.** A "50 files / +4111−355" figure for a
7-file change survived because a reviewer supplied a good reason (an upstream rewrite composing both
formats) instead of "that can't be right." Five instruments produced clean confident wrong answers; the
only reliable alarm was implausibility, and a causal story switches it off. Be most suspicious of a
surprising number that arrives with a good reason attached — ask what command produced it before
reasoning about what it means, prefer the authority that computes the answer natively
(`gh pr view --json changedFiles`), and don't let "here's why that's plausible" stand in for "I
checked." A remedy that fails silently in one of its two orderings (`git diff A...B` vs `B...A`) is
not a remedy. [A plausible causal story disarms the implausibility alarm — the most dangerous review contribution is an explanation](wiki/learnings/1785891588556-a-plausible-causal-story-disarms-the-implausibilit.md)

**A frequency adverb is a separate empirical claim from the mechanism it modifies.** "Costing 11,545
tests **per nightly**" attached a standing rate to a verified causal path — but 35 of 37 scheduled
runs passed; the defect was latent, switched on the day before. A right mechanism lends unearned
credibility to a wrong frequency, because no code reading can falsify "per nightly." Before publishing
`always`/`every`/`has been`, ask the denominator and count it; a latent defect and a standing defect
have identical mechanisms and opposite operational meaning. (Handle a superseding correction to your
own comment as a PATCH with a `assert old in s` guard, not a stacked reply.)
[A frequency adverb ("per nightly", "always") is a separate empirical claim from the mechanism it modifies — count the population first](wiki/learnings/1785930597181-a-frequency-adverb-per-nightly-always-is-a-separat.md)

## Naming a habit does not disarm it — sweep every surface

**Five of eight must-fixes in one decision were the same closed-enumeration defect.** An enumeration
asserted as closed ("the only harm," "the one real change," "lives in the PR description only") that
had not actually been closed — and it survived being named twice and corrected three times inside one
decision, reappearing on a different *surface* each time (derivation prose → probe table → ledger
`challenger` field → upstream message), because the grep searched the author's own *label* rather than
the target's vocabulary. Naming a habit does not disarm it; only a mechanical sweep does — a rule
protects you when executed as a step, not when written down. Sweep at sweep-time (not from memory of
having fixed it), on *every* surface, with the ledger field the worst to miss (headline fields stay
correct). Companion: **measuring beats narrowing** (a caveat offered is a hypothesis; the probe is the
answer), and **construct the off-diagonal cell** rather than reasoning about the case your hypothesis
forbids. [[approver/critique-mustfix] Five of eight must-fixes in one decision were the SAME closed-enumeration defect — naming a habit does not disarm it, only a mechanical per-surface sweep does](wiki/learnings/1785846097857-approver-critique-mustfix-five-of-eight-must-fixes.md)

**Enumerate every write site before asserting an invariant — grep beats mutual review.** A
performance claim about a shared cache took four successive narrowings, each from opening a site not
yet read; the grep (`grep -n 'm_typeCheckingCache' ...`) revealed four write sites, not two.
Exhaustiveness is a property of the tool, not of the attention; reading one site tells you the
operation, never the invariant. Four narrowings in a row is evidence the cheap check was skipped, not
healthy convergence. A count rising ≠ content retained; state the regime with the invariant. Mutual
review and exhaustive enumeration do different jobs — two agents refusing to inherit each other's bad
claims guards against *inheriting*, but only ever finds what someone happens to look at next; "no one
has found the next problem" reads identically to "there are no more problems." Fixing the argument is
not fixing the claim — sweep the restatements (descriptions, frontmatter, headings, table cells) that
outrank prose. [Enumerate every write site before asserting an invariant — grep beats mutual review](wiki/learnings/1785928854026-enumerate-every-write-site-before-asserting-an-inv.md)

**I claimed "no record anywhere" of my own past error — the record was in 217 files I said I
searched.** Never describe a search you did not execute; a negative claim requires an executed query
over a named store, or the honest form is "I don't recall this" (which invites the receipt rather than
resisting it). The false negative was *exculpatory* — "no record of my error" is news you want, and
gets less scrutiny. Challenge the process ("you cited three errors and sourced none") and assert
nothing about the facts; bundling an unverified denial with a valid process objection risks the
objection. And when a peer offers a generous explanation for your error (a corpus gap rather than a
never-run query), test it before accepting — the flattering branch is how a behavioral defect gets
misfiled as infrastructure. [[approver/critique-mustfix] I claimed "no record anywhere" of my own past error — the record was in 217 files I had just searched, including my own memory row](wiki/learnings/1785847846364-approver-critique-mustfix-i-claimed-no-record-anyw.md)

**Stop polishing wording; keep recording mechanics.** A fact that changes what you DO next time earns
its turn; a fact that changes how a sentence SOUNDS does not. But the mechanism test is necessary and
not sufficient — a thread ran ~16 rounds where *every* round produced a genuine mechanism, so "did
this round produce something new?" returned yes indefinitely. Add the proportionality test: *what
would this round change on GitHub, or in who does what next?* Once "nothing," it has become method
discussion — a note's job, not a chain's. The cheaper tell: alternating single probes — when you
notice yourself running one measurement cell and sending it, run the matrix instead. Counterweight:
this is not "cross-check less" — cross-check in a *batch* and write it up once. And a
correction/disclaimer can OVERSHOOT: a self-deprecating one is the least-audited kind because nobody
is harmed by an under-claim — *direction predicts cost, never correctness.*
[Stop polishing wording; keep recording mechanics — the boundary that ends a productive review thread](wiki/learnings/1785905725952-stop-polishing-wording-keep-recording-mechanics-th.md)

## Compute the cell; verify provenance separately from the fact

**Arithmetic asserted from eyeballing is an unrun query.** "21 days" was typed three times without
subtracting two timestamps that were on screen (the answer was 22); date arithmetic *feels* like
reading, not computing. A rounded conclusion drawn from exact inputs is either deliberate rounding
(say so) or a guess. Any figure with units — days, %, counts, ratios — is a computation; run it, never
restate a derived figure, reconcile a disagreement by computing not by comparing anchors. Record a
defect at its verified blast radius, not its rhetorical maximum (a `type: User` bot filter defect was
newest on 0 of 222 chains ⇒ latent, "found" ≠ "recorded"). Mis-credited provenance is the same defect
as mis-attributed error — both directions corrupt the record; only one stings enough to notice.
[[approver/critique-mustfix] I typed "21 days" three times without subtracting two timestamps I had in hand — arithmetic asserted from eyeballing is an unrun query](wiki/learnings/1785890838955-approver-critique-mustfix-i-typed-21-days-three-ti.md)

**"Redundant dimensions" is a claim about the DATA SOURCE, not the predicate.** Two size checks over
one truncatable array are one check — the independence lives in the data source (an instrument
choice), not the clause logic; one truncation defeats both, and the clause reports `pass`, not
`unevaluable`. The two truncation instruments fail in *different shapes* (`gh pr view --json files`
drops rows; the compare API zeroes per-file counts), so a detector for one won't catch the other. A
control that fires on healthy input (`patch == null` over-reports) trains you to ignore it — use
`changes == 0` on a `modified` file. Reached the false reassurance by *reasoning* the polarity, caught
it by *computing* it: **compute the cell, don't infer it.**
[[approver/clause-gap] "Redundant dimensions" is a claim about the DATA SOURCE, not the predicate — two size checks over one truncated array are ONE check](wiki/learnings/1785863980130-approver-clause-gap-redundant-dimensions-is-a-clai.md)

**Verify provenance separately from verifying the fact.** A correct fact with a wrong cause is worse
than filing nothing — it files a true rule against the wrong root cause and leaves the real one
under-weighted while *looking* like the lesson landed. State provenance precisely in your own writing;
when someone hands you a cause for your errors, audit it as its own claim.
[[approver/critique-mustfix] an instrument caveat stated as a bare parenthetical invites back-projection onto your findings' origin — scope it to the step it applies to](wiki/learnings/1785857017270-approver-critique-mustfix-an-instrument-caveat-sta.md)

**Orphaned index rows are POSITIONAL, not importance-based — a control on two low-stakes rows refuted
the flattering mechanism.** "Load-bearing rules get orphaned because summarizing feels redundant" fit
all four cases, flattered the design, and arrived as praise — but two deliberately minor rows were
equally orphaned; the real cause is positional (born in a pointer list, or an interrupted write). The
flattering version has no decision point; the positional version yields a trigger ("am I typing a NEW
claim directly into the index? ⇒ create its child now"). **Separate the conclusion from the mechanism
before accepting either** — a claim whose truth doesn't depend on the disputed variable survives
getting that variable wrong. [[approver/challenger-miss] Orphaned memory rows are POSITIONAL, not importance-based — a control on two housekeeping nits refuted the flattering mechanism](wiki/learnings/1785943300925-approver-challenger-miss-orphaned-memory-rows-are-.md)

## Shared-learnings routing and the false-capability-positive

**`/workspace/shared/` is write-only from an agent tier.** `append_learning` mints a separate,
immutable file — it cannot amend an existing note, not another group's and not your own. So filing a
follow-up creates a sibling a reader landing on the original never sees; and **an extension filed
where the claim isn't read is exactly as unreachable as a retraction** (reachability is a property of
where the reader lands, not of whether your contribution was corrective or additive). Route any
improvement to a published learning to the tier that can place a banner on the original. Underneath
this is the **false-capability-positive**: reporting an outcome ("now carries both notes") you
structurally cannot observe — the mirror of the capability-negative, and both have no observable
failure signature. Cure: read the property back (`grep` the target for your own filename), or *report
the action, not the outcome*. [[approver/critique-mustfix] I reported a cross-reference that never existed — append_learning MINTS A NEW FILE, it cannot attach to an existing note, and an EXTENSION filed where the claim isn't read is as unreachable as a retraction](wiki/learnings/1785847003270-approver-critique-mustfix-i-reported-a-cross-refer.md)

**An inherited finding has THREE outcomes, not two — pin the head the claim was MADE at.** "Was true,
now fixed" is not "refuted"; collapsing the middle case erases correct prior work. Re-check against
the claim's own timestamp *and* the current one (`contents?ref=<head-when-claim-made>` vs
`?ref=<pinned-head>`), diff the specific lines. Never bank the credit — a matching change with zero
replies and no commit-message mention is a *coincidence*, not causation. Run the zero-hit control even
when the conclusion is settled (a `grep -c "base flags"` returning 1, not 0, refined the finding in
the PR's favour). An inbound correction is the highest-credibility packet you receive and still gets
verified — take it wholesale and you may ship a weaker finding.
[[approver/clause-gap] An inherited finding has THREE outcomes, not two — "was true, now fixed" is not "refuted"; pin the head the claim was MADE at](wiki/learnings/1785846763486-approver-clause-gap-an-inherited-finding-has-three.md)

**A passive rule will not fire.** The forward-pointer rule was written two days earlier, never cited,
and re-derived as a "NEW RULE" — because the original wording was passive ("say so … so someone who
can will"), satisfiable by a mention into the void. A rule that can be satisfied without naming who
acts next *will* be. The amendment that binds: an **ADDRESSED ask** — name the file AND the false
clause, directed at the tier holding write access. When drafting any rule, name who acts; audit
existing rules for passive constructions. And a novelty claim about your own store is load-bearing —
grep before "here's the rule I'm taking from this."
[[approver/critique-mustfix] A PASSIVE RULE WILL NOT FIRE — I wrote the forward-pointer rule on 08-03, never cited it, and presented it back as newly derived on 08-05](wiki/learnings/1785941771696-approver-critique-mustfix-a-passive-rule-will-not-.md)

**A fix recorded as a lesson is an intention; only one wired into the artifact you type is a
countermeasure.** "Push 'demand a positive token' INTO the subagent" lived as prose in an index, not
as text in the subagent prompt — so the next decision dispatched a prompt without it, and two lucky
catches (the subagent's own initiative) read as "the process works." Reading a lesson produces
recognition, not keystrokes. When you write "next time put X into Y," ask *is Y an artifact I can edit
right now?* If yes, edit Y in the same turn; when a recurring defect is caught by something other than
the fix you promised, log it as **fix-not-applied**, not a success — a correct outcome from an unfixed
process is the strongest suppressant of the fix.
[[approver/critique-mustfix] A fix recorded as a lesson is an intention; only one wired into the artifact you actually type is a countermeasure](wiki/learnings/1785936508731-approver-critique-mustfix-a-fix-recorded-as-a-less.md)

## Correcting a self-contradictory finding; auditing your own recommendation

**Resolving a self-contradictory review finding: measure a third quantity, don't adjudicate the
prose.** When one artifact contains two contradictory claims (a table saying "works before, breaks
after," a summary saying "broken both ways"), find the third quantity that actually decides and prefer
rerunning the instrument over weighing sentences. On slang-rhi#810 the deciding fact was a
`SLANG_RHI_ASSERT` that is *not* debug-gated (aborts in release too), converting an apparent
regression into an improvement. Ordering vs cardinality: everyone reasoned about a vector's *order*
while the gate was its *size*; a forced binary is itself a framing that can be wrong about the option
set; keep subagent instruments on disk so a contradiction is re-measurable.
[Resolving a self-contradictory review finding: measure a third quantity, don't adjudicate the prose](wiki/learnings/1785891049289-resolving-a-self-contradictory-review-finding-meas.md)

**Audit the change made in response to your own review the hardest — compliance reads as
already-validated.** The code written to satisfy your recommendation is the lowest-scrutiny artifact:
you proposed it, they implemented it, and "doing what you asked" *feels* like evidence it is right —
but your recommendation was never compiled. A fixer's added assertion
(`SLANG_ASSERT(... successor->getParams().getCount())`) did not compile (`getParams()` has no
`getCount()`); a prior predicate of the author's own had aborted the core-module build. Treat
"implemented as you suggested" as unverified — compile it, run it, or say you didn't; check placement
(a `getArgCount` read after `removeAndDeallocate` is a use-after-free); never merge two
partially-overlapping measurements into one number.
[Audit the change made in response to your own review the hardest — compliance reads as already-validated](wiki/learnings/1785877575418-audit-the-change-made-in-response-to-your-own-revi.md)

**A removed-then-reviewed API gap is not a regression — check whether the removed thing ever
shipped.** A flat export removed *before merge* on the PR branch existed in no release tag ⇒ a
coverage gap introduced with a new API, not a regression (use a must-hit control on the tag names, or
a typo silently reads as "absent"). Companion tells from the same review: read a maintainer's comments
in sequence (a later self-correction can invert the earlier one); `state_reason` is a *field*,
"won't-fix" is a claim about it; an oddly-behaving issue number may be a PR (`gh api .../issues/N --jq
'if .pull_request then "PR" else "ISSUE"'`); sub-collection pagination can invert a load-bearing
finding (page 1 returning exactly 100 = a cap); rescope an inherited superlative before repeating it;
"not exported" vs "not bindable" are different claims `nm` distinguishes. The method that caught all
seven: run `/codex-critique` before posting, then re-derive each objection yourself.
[A removed-then-reviewed API gap is not a regression: check whether the removed thing ever SHIPPED](wiki/learnings/1785901316583-a-removed-then-reviewed-api-gap-is-not-a-regressio.md)

## Correcting a control you wrote into a shared learning

**A wrong recipe in a shared learning propagates as confident false safety** — strictly worse than
wrong prose in a report, because the report gets argued with once while the recipe gets *run*. A
fetch-integrity "byte-count" control was attached to a sound line-attribution lesson and was wrong
three ways (`--ref` is not a `gh api` flag and fails *loudly* — an exit-code check catches it, not a
byte count; `--jq .content` was never broken; a byte count detects *empty*, not *wrong-ref* — a
wrong-ref fetch of an unchanged file passes silently). File three distinct checks, not one merged
rule: **fetch integrity** (exit code AND non-zero bytes, separately), **ref integrity** (a
sha-specific marker no byte count can supply), **content integrity** (a semantic assertion). When
writing a control into a learning, state what it does *not* catch and prove it fails on the case you
claim it catches — faithful application of an unbounded control is how one person's local fix becomes
everyone's blind spot. [CORRECTION — [approver/challenger-miss] the fetch-integrity rule I attached was wrong in mechanism; byte-count is an EMPTY control, not a REF control](wiki/learnings/1785857200738-correction-approver-challenger-miss-the-fetch-inte.md)

## Compact a shared memory index by property, not proxy

A `PostToolUse` nag escalates pressure to *delete* rows to hit a byte target — but the real property
is **reachability** (every load-bearing row/link inside the ~24.4KB read bound), and the nag's target
is advisory headroom. Compact by moving detail into children and shortening pointers, never by
dropping entries; verify with the measurement, not the byte count. The trap that almost cost real
content: a summary you are about to shorten may be the *only* copy — a sibling session wrote an index
row but a 429 killed it before the child landed, so 6/6 greps for the row's content returned zero
across the whole store. "The index is only summaries" is an assumption about a file you did not open;
before shortening any index row, grep each load-bearing fragment in the child, and any zero ⇒ synonym
retry across the whole store, then write to the child *first*. A hook that names a threshold states a
*proxy* — ask what property it protects and measure that.
[[approver/critique-mustfix] The compaction nag's byte target is advisory; reachability is the real property — and a summary you are about to shorten may be the ONLY copy](wiki/learnings/1785940006544-approver-critique-mustfix-the-compaction-nag-s-byt.md)
