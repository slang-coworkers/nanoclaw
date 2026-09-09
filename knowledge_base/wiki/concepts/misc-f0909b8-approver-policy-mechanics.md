---
title: "Approver policy resolution, empty-mount drift, and infra-vs-policy reason codes"
type: concept
group: misc
tags: [slang-pr-approver, eval-clauses, policy-mount, v0-shadow, head_provenance, author_trust, tier_eligible, ABSTAIN_POLICY, reason_code, record_decision]
source_count: 21
---

## TL;DR

The slang PR-approver's Step-1 eligibility gate (`eval-clauses.py`) resolves its
policy fresh **every run** in a fixed precedence: `--policy` → per-PR
`<ws>/policy/APPROVAL_POLICY.json` → group mount
`/workspace/extra/approver-policy/APPROVAL_POLICY.json` → bundled default
`scripts/APPROVAL_POLICY.json` (which is the strict `v0-shadow`). The dominant
failure mode in this batch: the operator-signed wide mount (`v0-shadow-wide`,
`allow_fork_head:true`, big caps) **silently vanishes between sessions/revisions**,
so the script falls back to the stricter bundled `v0-shadow` — flipping
`author_trust`, `head_provenance`, `no_protected_paths`, and `tier_eligible` from
PASS to FAIL on a byte-identical PR. This is *documented, by-design* fallback, so
the resulting `CLAUSE_FAIL` is a **policy** abstain, not infra — with one sharp
exception (below).

Recurring rules distilled across ~21 atoms:

- **Diff `policy_version` across revisions like you diff the head SHA.** A silent
  `v0-shadow-wide → v0-shadow` flip between rounds of the same PR is the tell that
  the mount was lost, not that the code changed.
- **Three clauses are pure policy predicates that abstain independent of code
  quality:** `author_trust` (bot/CONTRIBUTOR not in trusted set), `head_provenance`
  (fork head, even from trusted MEMBERs), `tier_eligible` (size cap). Never round
  a Step-1 clause-fail up to WOULD_APPROVE because "the code is obviously fine" or
  "a human already approved."
- **Empty-mount fallback = POLICY `CLAUSE_FAIL`, NOT infra** — the bundled default
  is a present, coherent policy; nothing recoverable is hidden. The one contested
  atom argued for `HARNESS_FAIL` (infra) + reconstruct-from-last-known-good; the
  operator's standing doc (`operations/approver-policy-mount.md`) overrode it:
  decide under the bundled default, record honest `CLAUSE_FAIL`, don't reconstruct,
  don't re-escalate per-PR (one standing escalation is open).
- **Never reconstruct the signed policy from memory to decide under it** —
  fabricating the policy environment is the same anti-pattern as masking
  out-of-contract input.
- **Host `record_decision` enum is 3-state:** `{WOULD_APPROVE, BLOCK,
  ABSTAIN_POLICY}`. `ABSTAIN_INFRA` was deliberately retired (host task #14) and is
  accepted-then-silently-ignored. Carry infra-vs-policy in the `reason_code`, never
  the decision enum.
- **`commit_match=unevaluable` after a correct early-return is a consequence of the
  early return, not a defect** — record the policy `CLAUSE_FAIL`, never the infra
  `CLAUSE_UNEVALUABLE:commit_match`.

## Policy is resolved per run — the head SHA is not the only thing that moves

A large sub-cluster of atoms documents the *identical* mechanism on different PRs:
the same PR re-entering as a `synchronize` revision flips from WOULD_APPROVE to
ABSTAIN with **nothing in the diff explaining it**. The cause is always that the
effective policy changed underneath the decision. `eval-clauses.py` reads its
policy fresh each run, and when the group mount is empty it uses the bundled
`v0-shadow` default. The canonical detector, repeated verbatim across atoms, is to
read `clauses.json`'s `policy_version` every revision and compare it to the prior
row for the same PR.

Representative instances: a PR whose reason migrated across three revisions while
the author fixed every code concern yet stayed size-cap-blocked
[migrating reason across revisions](../learnings/1788155800246-approver-clause-gap-a-pr-can-resolve-every-code-co.md);
`v0-shadow-wide → v0-shadow` between two re-evals days apart
[vanished mount stricter default](../learnings/1788197760978-approver-clause-gap-the-effective-policy-can-chang.md);
empty mount silently changing a decision across revisions
[empty mount bundled fallback](../learnings/1788199841834-approver-clause-gap-empty-policy-mount-bundled-def.md);
same author flipping trusted→untrusted between revisions
[policy resolves per-run](../learnings/1788221793357-approver-clause-gap-policy-resolves-per-run-same-a.md);
a `head_provenance` PASS→FAIL flip on the same fork PR
[surprising provenance flip is a policy-source flip](../learnings/1788254985230-approver-clause-gap-a-surprising-head-provenance-c.md);
a WOULD_APPROVE→ABSTAIN flip on a strictly-*improved* revision
[same PR flips WOULD_APPROVE→ABSTAIN](../learnings/1788257784418-approver-clause-gap-same-pr-can-flip-would-approve.md);
and the whole-class flip to `CLAUSE_FAIL:head_provenance` for every fork PR
[mount vanishing narrows to bundled](../learnings/1788303996800-approver-infra-abstain-group-policy-mount-vanishin.md),
[mount can silently vanish → spurious author_trust fail](../learnings/1788380005738-approver-infra-abstain-group-policy-mount-can-sile.md).
The correction that the *live* policy is `v0-shadow` (not the wiki-recalled
`v0-shadow-relaxed`), so dependabot/bot bumps deterministically abstain, is the
same lesson applied at Step-0 recall time
[live policy is v0-shadow not relaxed](../learnings/1788364513812-approver-clause-gap-live-policy-is-v0-shadow-not-r.md).

## The three policy-predicate clauses that abstain regardless of code

`author_trust`, `head_provenance`, and `tier_eligible` are data-only gates that
short-circuit **before** the verdict parse and challenger run. Two are orthogonal:
a trusted MEMBER pushing from their personal fork still trips `head_provenance`
because `allow_fork_head:false`
[head_provenance abstains trusted fork PRs](../learnings/1788193090245-approver-clause-gap-head-provenance-abstains-trust.md),
[head_provenance auto-abstains fork-head MEMBERs](../learnings/1788228010835-approver-clause-gap-head-provenance-auto-abstains-.md).
Because essentially all external slang contributions come from forks, this
auto-abstains a large fraction of eligible PRs; frequent fork contributors
(`author_association=CONTRIBUTOR`) are a foregone abstain on both `author_trust`
and `head_provenance`
[frequent fork contributors abstain on provenance](../learnings/1788264216124-approver-human-agreement-frequent-fork-contributor.md).
Our own fixer output (`nv-slang-bot[bot]` on `fix/issue-N` branches) is likewise a
foregone `CLAUSE_FAIL:author_trust`, and the production claude-code-action review
skips bot branches so the review tier is always the CodeRabbit/Devin fallback
[bot-authored fix/issue-N PRs abstain](../learnings/1788247698213-approver-clause-gap-bot-authored-fix-issue-n-prs-a.md).
For all of these the skill's early-return is correct — do not sink deep challenger
effort into a decided-abstain. Loosening any of them (e.g. `allow_fork_head:true`,
trusting the fixer bot's identity) is a deliberate operator policy change, never an
approver-side reinterpretation.

## Empty mount is POLICY, not infra — the one contested distinction

Several atoms initially reasoned that a vanished signed mount should be recorded as
an **infra** abstain (`HARNESS_FAIL`) and escalated, because "an infra regression
produced a conservative outcome"
[vanished signed mount → HARNESS_FAIL](../learnings/1788244739337-approver-infra-abstain-a-vanished-group-mounted-si.md),
[empty mount is an infra regression, decide under LKG + escalate](../learnings/1788294009551-approver-infra-abstain-an-empty-policy-mount-is-an.md).
The resolved doctrine — established by the operator's standing note and a codex
must-fix — is the opposite: the bundled default is a *present, coherent* policy, the
clause evaluates cleanly to `fail` (not `unevaluable`), and **nothing recoverable
is hidden**, so it is a legitimate POLICY `CLAUSE_FAIL`
[empty-mount fallback is POLICY not infra](../learnings/1788295933040-approver-clause-gap-an-empty-mount-fallback-clause.md),
[decide under bundled default, honest CLAUSE_FAIL, never LKG reconstruction](../learnings/1788297294911-empty-approver-policy-mount-decide-under-bundled-c.md).
The discriminating test: *is real, recoverable signal being suppressed by a defect
(→ infra, recover it), or did a coherent-but-narrower policy legitimately produce
this result (→ policy `CLAUSE_FAIL`)?* This contradicts the reconstruct-from-LKG
recipe in [decide under last-known-good + escalate](../learnings/1788294009551-approver-infra-abstain-an-empty-policy-mount-is-an.md);
per [documented rule outranks off-hand praise](../learnings/1788297294911-empty-approver-policy-mount-decide-under-bundled-c.md)
the documented standing rule wins and reconstruction is forbidden. The cost is
real, though: an empty mount converts human-concordant WOULD_APPROVEs into abstains
on PRs that merge — a demonstrated *suppression* of agreement signal, not neutral
[merge outcome: empty mount suppresses agreement](../learnings/1788247100859-approver-infra-abstain-merge-outcome-an-empty-poli.md);
and "same outcome bucket" is not "same decision" — the fallback can swap a
substantive `OPEN_GAP` reason_code for a bare eligibility `CLAUSE_FAIL`, discarding
the more-informative signal the human reads
[same outcome ≠ same decision, reason_code matters](../learnings/1788300036648-approver-clause-gap-an-empty-group-policy-mount-si.md).

## Recording mechanics: enum, reason-code precedence, early return

Two host-interface traps: `record_decision` accepts only
`{WOULD_APPROVE, BLOCK, ABSTAIN_POLICY}` — passing `ABSTAIN_INFRA` returns a
misleading success echo then is silently ignored; the authoritative signal is the
host notification, not the tool echo
[record_decision enum is 3-state](../learnings/1788254755215-approver-infra-abstain-record-decision-host-enum-i.md).
This was later confirmed by-design (ABSTAIN_INFRA retired in host task #14; the
SKILL.md's 4-state taxonomy is stale): emit `ABSTAIN_POLICY` with an infra
`reason_code` (`HARNESS_FAIL`, `NO_REVIEW_SIGNAL`, `CLAUSE_UNEVALUABLE:<name>`,
`CHALLENGER_INCOMPLETE`, `CRITIQUE_UNAVAILABLE`, `STALE_STAGE`) — and when both an
infra gap and a decidable merits gap exist, record the merits reason (`OPEN_GAP`)
and escalate the infra gap separately
[ABSTAIN_INFRA retired, use reason_code](../learnings/1788254975863-approver-infra-abstain-confirmed-by-design-abstain.md).
On a hard Step-1 clause fail, early-returning before building the review doc leaves
`commit_match=unevaluable`; that is a consequence of the early return — record the
operative `CLAUSE_FAIL:<name>` (policy, working-as-intended), never the infra
`CLAUSE_UNEVALUABLE:commit_match`, because FAIL(policy) dominates the incidental
unevaluable(infra) in reason precedence and mis-coding it would trip the
infra-abstain gate
[early-return leaves commit_match unevaluable](../learnings/1788372034095-approver-procedure-early-return-on-a-clause-fail-l.md).

**Source learnings (21):**

- [A PR can resolve every code concern yet stay un-approvable on the size cap](../learnings/1788155800246-approver-clause-gap-a-pr-can-resolve-every-code-co.md) — #12830 abstained 3× with the reason migrating (SIGSEGV → tier_eligible → tier_eligible) as the author fixed things; say plainly when an abstain is size-only, and verify "prior 🔴 addressed" by enumerating callers.
- [head_provenance abstains trusted MEMBER fork PRs](../learnings/1788193090245-approver-clause-gap-head-provenance-abstains-trust.md) — author_trust does not override head_provenance; do a lightweight challenger read anyway and stash a `preempted_observation` for the fork-head handoff.
- [The effective policy can change across revisions of the same PR](../learnings/1788197760978-approver-clause-gap-the-effective-policy-can-chang.md) — vanished mount silently falls back to stricter bundled default; diff policy_version each revision and flag shifts.
- [Empty policy mount → bundled-default fallback can silently change a decision](../learnings/1788199841834-approver-clause-gap-empty-policy-mount-bundled-def.md) — #12795 flipped between revisions; a Step-1 clause FAIL early-returns regardless of clean code or existing human approval.
- [Policy resolves per-run: same author can flip trusted→untrusted](../learnings/1788221793357-approver-clause-gap-policy-resolves-per-run-same-a.md) — #12538 CONTRIBUTOR passed at R1, failed at R2 under bundled default; empty group mount is the defined fallback, so CLAUSE_FAIL not infra.
- [head_provenance auto-abstains fork-head PRs even from trusted MEMBERs](../learnings/1788228010835-approver-clause-gap-head-provenance-auto-abstains-.md) — #12858; contributors routinely push from personal forks, so this auto-abstains a large fraction; allow_fork_head:true is an operator lever.
- [A vanished group-mounted signed policy → spurious CLAUSE_FAILs; record HARNESS_FAIL](../learnings/1788244739337-approver-infra-abstain-a-vanished-group-mounted-si.md) — early framing arguing the vanished-mount case is infra + escalate group-wide (later superseded by the "empty-mount is policy" doctrine).
- [Merge outcome: empty policy mount converts human-concordant WOULD_APPROVEs into abstains](../learnings/1788247100859-approver-infra-abstain-merge-outcome-an-empty-poli.md) — #12754 merged at the ABSTAIN'd head; the empty mount demonstrably suppressed agreement signal; also weigh CI per platforms the change actually affects.
- [Bot-authored fix/issue-N PRs are a foregone ABSTAIN_POLICY:CLAUSE_FAIL:author_trust](../learnings/1788247698213-approver-clause-gap-bot-authored-fix-issue-n-prs-a.md) — #12542; claude-code-action skips bot branches (fallback tier) AND author_association=CONTRIBUTOR fails author_trust; early-return, don't over-investigate.
- [record_decision host enum is 3-state; ABSTAIN_INFRA rejected](../learnings/1788254755215-approver-infra-abstain-record-decision-host-enum-i.md) — slang-rhi#841 R4; ABSTAIN_INFRA is accepted-then-ignored (trust the host notification, not the echo); a vanished mount must not be recorded as CLAUSE_FAIL (early framing).
- [ABSTAIN_INFRA is retired by design — use ABSTAIN_POLICY + infra reason_code](../learnings/1788254975863-approver-infra-abstain-confirmed-by-design-abstain.md) — host task #14; enumerates the infra reason_codes; when both infra and merits gaps exist, record the merits reason and escalate infra separately.
- [A surprising head_provenance/clause FAIL can be a policy-source flip](../learnings/1788254985230-approver-clause-gap-a-surprising-head-provenance-c.md) — #12690 PASS→FAIL on the same fork PR; read the effective policy source before recording; CLAUSE_FAIL is honest but ALSO escalate the flip.
- [Same PR can flip WOULD_APPROVE→ABSTAIN when the mounted policy changes](../learnings/1788257784418-approver-clause-gap-same-pr-can-flip-would-approve.md) — #12607 flipped despite the revision improving; a missing group mount is documented fallback (CLAUSE_FAIL), not infra.
- [An EMPTY policy mount is an infra regression — decide under LKG signed policy + escalate](../learnings/1788294009551-approver-infra-abstain-an-empty-policy-mount-is-an.md) — #12136 R5; argued for reconstruct-from-last-known-good (contradicted by the resolved bundled-default doctrine below).
- [An empty-mount fallback CLAUSE_FAIL is POLICY, not infra; read operations/ first](../learnings/1788295933040-approver-clause-gap-an-empty-mount-fallback-clause.md) — #12446 R12; the exit-21 infra analogy is wrong (nothing recoverable is hidden); read memory/operations/* at session start.
- [Empty approver-policy mount → bundled conservative default, never LKG reconstruction](../learnings/1788297294911-empty-approver-policy-mount-decide-under-bundled-c.md) — the operator's documented standing rule; reconstruction = fabricating the policy environment; a documented rule outranks off-hand orchestrator praise.
- [An empty group policy mount silently downgrades a substantive OPEN_GAP to a bare CLAUSE_FAIL](../learnings/1788300036648-approver-clause-gap-an-empty-group-policy-mount-si.md) — #12452; "same outcome" is not "same decision" — the early-return discards the substantive finding; carry it as human-facing context.
- [Group policy mount vanishing silently narrows to bundled v0-shadow](../learnings/1788303996800-approver-infra-abstain-group-policy-mount-vanishin.md) — #12752 R1→R2 flipped head_provenance; whole-PR-class behavior change from a missing file; record honestly AND surface the mount loss.
- [Live policy is v0-shadow (NOT relaxed) — dependabot/bot PRs ABSTAIN on author_trust](../learnings/1788364513812-approver-clause-gap-live-policy-is-v0-shadow-not-r.md) — #12878 grpc bump; trust the script's policy_version over recalled "WOULD_APPROVE precedent"; a MEMBER reviewer's approval does not flip the author's association.
- [Early-return on a clause FAIL leaves commit_match=unevaluable — record the FAIL reason](../learnings/1788372034095-approver-procedure-early-return-on-a-clause-fail-l.md) — #12882; FAIL(policy) dominates the incidental CLAUSE_UNEVALUABLE(infra) so the misleading stdout hint is not the decision.
- [Group policy mount can silently vanish → spurious author_trust fail](../learnings/1788380005738-approver-infra-abstain-group-policy-mount-can-sile.md) — #12820 later synchronize; ls the mount + agent/policy dirs when a clause flips; this atom argues for an infra reason_code (in tension with the resolved policy-CLAUSE_FAIL doctrine — reconcile per the operations note).
