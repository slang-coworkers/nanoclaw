---
title: Approver decision policy — never round up, the ABSTAIN taxonomy, and human-as-calibration
type: concept
group: review-process
tags: [approver, abstain, never-round-up, fallback-tier, human-verdict, calibration, circular, synthesis, challenger, ci-blind, output-review]
source_count: 12
---

## TL;DR

The slang/slangpy PR-approver runs in SHADOW MODE: its value is being an INDEPENDENT signal scored
against the human outcome. Two structural rules protect that independence, and most of this cluster
is one or the other being violated and caught by the codex critique gate.

- **Never round up.** The decision enum is CLOSED {WOULD_APPROVE | ABSTAIN_POLICY | BLOCK}. The
  challenger's investigation can only ADD CAUTION — it may never upgrade a review-doc's 🔴 toward
  approval, and it may not record BLOCK on a finding it has disproven. "Inability to complete the
  check ⇒ ABSTAIN." A verifiably-false fallback-tier Devin 🔴 still forces ABSTAIN, not BLOCK
  (untruthful) and not WOULD_APPROVE (forbidden upgrade).
- **The review-INPUT tier is {harvested bot review, Devin} ONLY.** Human reviews / CI / a MEMBER
  approval / "substantively identical" are join/calibration/context — NOT inputs. Feeding a human
  approval back in as decision input is CIRCULAR: it manufactures a row that can never disagree with
  the outcome it is measured against, destroying the calibration loop.
- **Synthesis counts what the reviewer REPORTED; the challenger clears in a separate disposition
  field.** Don't pre-net your own clearing judgment into `gaps: 0`. Two-file separation: the
  review-doc carries the source verdict conservatively mapped (refutation-free); `investigation.md`
  carries the challenger's clearing.
- **Missing/stale head-current review signal ⇒ ABSTAIN**, regardless of how sound your own source
  read is or how the humans voted. NO_REVIEW_SIGNAL (infra family) vs OPEN_GAP/CHALLENGER_CONCERN
  (policy family) is a real distinction the reason_code encodes.
- **OUTPUT_REVIEW is not a rubber stamp on a DECISION_REVIEW-approved derivation** — give it a
  genuinely different question (the deliverable's factual reach; the UNSTATED error paths), because
  it can catch a decision-level defect the derivation review structurally won't.

## Never round up: the fallback-tier 🔴 is a two-sided lock

The forbidden-upgrade rule is the spine. On slang#12600 R2 the r1 gap was genuinely fixed and the
change was clean on merits, but the fallback-tier Devin report carried a 🔴 ("formatting check now
fails for every PR") that was factually FALSE (refuted by the green check-formatting run on the exact
head). The trap is to zero the bug on your own investigation and record WOULD_APPROVE — DECISION_REVIEW
correctly flags this must-fix. The two-sided rule: you may NOT round UP to WOULD_APPROVE by zeroing the
bug (the challenger is not a reviewer that can overrule the signal); you may NOT round DOWN to BLOCK
unless you VERIFIED the 🔴 is real (BLOCK asserts a verified bug). The truthful state is
ABSTAIN_POLICY:CHALLENGER_CONCERN — transcribe Devin's findings faithfully (bugs:1), keep the merits
refutation as separate commentary, and abstain. Devin false-🔴s are exactly why the fallback tier never
auto-approves
([fallback-tier Devin false-🔴 forces ABSTAIN even when the finding is verifiably wrong](../learnings/1787852456659-approver-infra-abstain-fallback-tier-devin-false-f.md)).

This is enforced by keeping the SOURCE verdict and the challenger's refutation in separate files. On
slang-rhi#846 the review-doc was synthesized with `APPROVE_WITH_NITS`/gaps=0 because the one 🟠 Major
had already been refuted INSIDE the doc — collapsing the prior (what the source reviewer said) and the
challenger (what you concluded after investigating) into one voice. The fix: `review-doc.md` = source
verdict, conservatively mapped (🟠 ⇒ REQUEST_CHANGES as a non-🔴 gap), refutation-free;
`investigation.md` = the challenger's clearing reasoning. The final decision can still land
WOULD_APPROVE after the challenger legitimately clears a non-🔴 finding — what's disallowed is
pre-clearing it in the prior, even when the refutation is correct
([fallback-tier review doc must synthesize the SOURCE verdict; the refutation goes in the challenger](../learnings/1787854931569-approver-critique-mustfix-fallback-tier-review-doc.md)).

The same separation applies to COUNTING. On slang#12601 the challenger judged CodeRabbit's one 🟡 nit
pre-existing and wrote `gaps: 0` at synthesis time; DECISION_REVIEW returned must-fix because gaps:0
contradicts a documented 🟡. Synthesis transcribes what the reviewer reported (CodeRabbit's "Actionable
comments posted: N" maps to N gaps; Devin bugs→🔴, flags→🟡); the challenger clears each in the gap
DISPOSITION, not by editing the count. Writing gaps:0 because you decided to clear it pre-nets the
posterior into the prior and destroys auditability — a reader can't tell "found nothing" from "found
something I cleared." A gaps:0 next to a body saying "Actionable comments posted: 1" is the smell
([fallback-tier synthesis: count findings the reviewer reported, don't pre-net the challenger's clear into gaps=0](../learnings/1787054735978-approver-critique-mustfix-fallback-tier-synthesis-.md)).

## Human reviews are the answer key, not an input (circularity)

The strongest pull toward rounding up is a positive human outcome already on the PR — and it is exactly
the input the procedure forbids. On slang#12666 R3 the head arrived with two head-current human APPROVES
and the challenger independently found the code sound; feeding the humans' approval in as the "now-present
review tier" is circular, because shadow mode exists to measure the approver INDEPENDENTLY against the
human outcome. The input state was identical to R2 (harvest exit 20 + Devin stale) ⇒ NO_REVIEW_SIGNAL,
regardless of how the humans voted; the abstain joins APPROVED as a predicted INFRA false-negative, not a
code disagreement
([human approvals at head do NOT satisfy the review-input tier — using them is circular](../learnings/1787711999351-approver-infra-abstain-human-approvals-at-head-do-.md)).
The same lesson from the routing/relay side: when re-dispatching to a pr-approver, do not assert that
human approvals satisfy its review-input requirement — report them as context and let the approver's own
tiers drive; and a review body is bound to a specific commit + state, so never quote a dismissed or
earlier-commit review as head signal
([human PR approvals are NOT the "missing review tier" — verify which commit a quoted review binds to](../learnings/1787712111448-approver-human-reviews-are-not-a-decision-input-ti.md)).

On the `live_late` tier (a human review already exists) the same contamination hides in the derivation
TEXT: on slang#12719 three separate stale references cited the maintainer's APPROVE as supporting
evidence, each a must-fix, because `mode=live_late` is ONLY a ledger tag for the post-hoc join — using
that approval as verdict input makes the join circular. On the Devin-only tier the Step-2 verdict must
come from Devin ALONE; the final decision is Devin-verdict + eligibility clauses + the independent
challenger; the human approval feeds neither. Grep the artifacts for the reviewer's login / "APPROVE" /
"maintainer" and confirm every occurrence is framed as calibration outcome, not input — a single stale
sentence at the top of a doc fails the gate
([live_late human approval must not feed the Devin-only verdict](../learnings/1787697839227-approver-critique-mustfix-live-late-human-approval.md)).

## Missing head-current signal ⇒ ABSTAIN — even for the safest-looking change

A missing review signal cannot be manufactured from a clean own-read, a MEMBER approval, green CI, or
"it's only a rename." On slang#12379 the interval head-vs-reviewed was exactly ONE commit — a pure rename
of a byte-identical export list — but that rename is precisely the failure mode that could silently break
the version-script path and disable the whole fix; there was no head-current REVIEW signal, so binding the
`_approver_result` to the head to force a `commit_match` pass MANUFACTURED a pass no review earned. Set
the review-doc's `commit_id` to the commit the review ACTUALLY examined and let `eval-clauses.py` fail
commit_match on its own ⇒ ABSTAIN_POLICY (STALE_STAGE); never hand-set commit_id=head
([a pure-rename-only commit past the reviewed revision still breaks commit_match — abstain, don't relabel to head](../learnings/1787270972234-approver-infra-abstain-a-pure-rename-only-commit-p.md)).

Conversely, a Devin TIMEOUT is not automatically an infra abstain: on slangpy#1108 Devin exited 3
(timeout, ~20m) with no `devin-flags.md`, but the CodeRabbit harvest succeeded, so
`reviewers_complete=true` — only "no bot review harvested AND Devin failed/absent" is NO_REVIEW_SIGNAL.
Kick Devin off early in parallel with the CodeRabbit poll, set a bounded waiter, and proceed on
CodeRabbit alone if Devin hasn't landed; if Devin is the ONLY possible signal and it times out, THEN
it's ABSTAIN_INFRA:NO_REVIEW_SIGNAL
([Devin timed out (exit 3) — CodeRabbit harvest saved it from NO_REVIEW_SIGNAL](../learnings/1786694523997-approver-infra-abstain-devin-review-timed-out-exit.md)).

## Structural blind spots the automated reviewers cannot see ⇒ CHALLENGER_CONCERN

Some changes are safe on the diff text but risky in a dimension no diff-scoped reviewer inspects, and CI
carries the signal. On slangpy#1120 an `external/vcpkg` submodule-pointer bump had a one-line diff but an
enormous behavioral blast radius; all three automated reviewers were CI-blind (Claude skipped the PR
shape, CodeRabbit path-excludes `external/**`, Devin is diff-only) and the head still failed to build on
Windows MSVC. Treat any `external/**` / submodule / dependency-baseline bump as a build-coverage question:
pull the head's build check-runs, confirm the base builds green, and record ABSTAIN_POLICY:CHALLENGER_CONCERN
with the failing job IDs — never round the "clean" automated reviews up to WOULD_APPROVE
([external/** submodule bump: all automated reviewers are CI-blind — read check-runs](../learnings/1787214509534-approver-challenger-external-submodule-bump-all-au.md)).

For a test-only regression-guard PR, the decisive evidence is the opposite of Devin-clean: "the new test
passes in CI" is the ENTIRE value of the PR. On slangpy#1117 the approver had to identify which job
actually runs the new test (GitHub-hosted `build(...)` jobs are build-only; GPU tests run only on
self-hosted runners with the `unit-test` flag) and read the job log to confirm the test's
parametrizations show PASSED (not SKIPPED) with `0 failed`. Devin-clean ≠ test-clean — do the CI
positive-control read yourself
([test-only regression PR: confirm the NEW test ran green in the CI job that actually runs it](../learnings/1787148033918-approver-confirmed-test-only-regression-pr-confirm.md)).

Accepted-but-unpushed reviewer feedback is a wait, not an approve: on slang#12410 R1 the author had
publicly accepted two reviewer asks (drop a fixture + a macro→template rewrite) and pushed neither, so the
right call was ABSTAIN_POLICY/OPEN_GAP — do not approve a head the author has announced they will
materially replace (a `COMMENTED`-state review does not make accepted-and-pending feedback non-blocking).
R2 (both changes landed) re-gated fresh to WOULD_APPROVE and matched the human APPROVE + merge; the
residual risk in a mechanical prelude/runtime-op rewrite is compile-time-only and CI-covered
([accepted-but-unpushed reviewer feedback → abstain on the stale head, approve the rewrite](../learnings/1787312394373-approver-confirmed-safe-accepted-but-unpushed-revi.md)).

## OUTPUT_REVIEW gets a different question — and catches decision-level defects

The two critique gates are not redundant. On slang#12729 DECISION_REVIEW audited the STATED
successful-compile safety proof and cleared it after 5 rounds; OUTPUT_REVIEW (round 6) asked the DIFFERENT
question "can an ERRORED module carrying the pointer ever be serialized?" and found a reachable
error-retention + public-serialize path the happy-path proof never covered, flipping WOULD_APPROVE→ABSTAIN.
Two transferable rules: for any "X is stripped before it can escape" claim, enumerate the FAILURE/
early-return exits and the PERSISTENCE API surface, not just the happy path; and an independent reviewer's
UNRESOLVED Moderate ("wait for owner acceptance") is an ABSTAIN signal, not a hurdle to argue past — you
may disagree only with a CONCLUSIVE exclusion. Because an abstain is ungated, a late-surfaced gap can
always be honestly recorded
([OUTPUT_REVIEW flipped WOULD_APPROVE→ABSTAIN: audit the UNSTATED error paths, never round up past an unresolved Moderate](../learnings/1787660015668-approver-false-safe-averted-output-review-flipped-.md)).

**Source learnings (12):**

- [Devin review timed out (exit 3) — CodeRabbit harvest saved it from NO_REVIEW_SIGNAL](../learnings/1786694523997-approver-infra-abstain-devin-review-timed-out-exit.md) — slangpy#1108; a Devin timeout WITH a harvested CodeRabbit review is a degraded-but-sufficient fallback tier; kick Devin off early with a bounded waiter.
- [Fallback-tier synthesis: count findings the reviewer reported, don't pre-net the challenger's clear into gaps=0](../learnings/1787054735978-approver-critique-mustfix-fallback-tier-synthesis-.md) — slang#12601; synthesis transcribes the reported N; the clear lives in the gap disposition, preserving the audit trail.
- [Test-only regression PR: confirm the NEW test ran green in the CI job that actually runs it, not just Devin-clean](../learnings/1787148033918-approver-confirmed-test-only-regression-pr-confirm.md) — slangpy#1117; map flag→job from ci.yml; read the job log for PASSED (not SKIPPED) + `0 failed`.
- [A pure-rename-only commit past the reviewed revision still breaks commit_match — abstain, don't relabel to head](../learnings/1787270972234-approver-infra-abstain-a-pure-rename-only-commit-p.md) — slang#12379; a rename is exactly the failure mode that could break the fix; set commit_id to the reviewed commit and let commit_match fail.
- [Accepted-but-unpushed reviewer feedback → abstain on the stale head, approve the rewrite](../learnings/1787312394373-approver-confirmed-safe-accepted-but-unpushed-revi.md) — slang#12410; R1 OPEN_GAP predicted the superseding rewrite; R2 re-gated fresh to WOULD_APPROVE and matched the human merge.
- [Fallback-tier Devin false-🔴 forces ABSTAIN even when the finding is verifiably wrong — don't zero it, don't round it to BLOCK](../learnings/1787852456659-approver-infra-abstain-fallback-tier-devin-false-f.md) — slang#12600 R2; transcribe bugs:1 faithfully, keep the merits refutation separate, record CHALLENGER_CONCERN.
- [Fallback-tier review doc must synthesize the SOURCE verdict; the approver's refutation goes in the challenger, not the prior](../learnings/1787854931569-approver-critique-mustfix-fallback-tier-review-doc.md) — slang-rhi#846; two-file separation keeps Step-2 parse and Step-3 challenger independent.
- [live_late human approval must not feed the Devin-only verdict](../learnings/1787697839227-approver-critique-mustfix-live-late-human-approval.md) — slang#12719; mode=live_late is only a ledger tag; grep the artifacts to confirm every human-approval reference is framed as calibration, not input.
- [Human approvals at head do NOT satisfy the review-input tier — they are the join/outcome you're scored against (using them = circular)](../learnings/1787711999351-approver-infra-abstain-human-approvals-at-head-do-.md) — slang#12666 R3; input tier is {bot review, Devin} only; abstain joins APPROVED as a predicted infra false-negative.
- [When re-dispatching to a pr-approver, human PR approvals are NOT the "missing review tier"](../learnings/1787712111448-approver-human-reviews-are-not-a-decision-input-ti.md) — the relay-side mirror; report humans as context; verify which commit + state a quoted review binds to before citing it.
- [OUTPUT_REVIEW flipped WOULD_APPROVE→ABSTAIN: audit the UNSTATED error paths, never round up past an unresolved Moderate](../learnings/1787660015668-approver-false-safe-averted-output-review-flipped-.md) — slang#12729; enumerate failure/early-return exits + persistence API; an unresolved reviewer Moderate is an ABSTAIN signal; OUTPUT_REVIEW gets a different question.
- [external/** submodule bump: all automated reviewers are CI-blind — read check-runs](../learnings/1787214509534-approver-challenger-external-submodule-bump-all-au.md) — slangpy#1120; a one-line submodule bump broke Windows MSVC while all three reviewers cleared; treat it as a build-coverage question ⇒ CHALLENGER_CONCERN.
