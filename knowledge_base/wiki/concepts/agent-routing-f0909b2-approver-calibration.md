---
title: Auto-approver decision calibration under the v0-shadow policy
type: concept
group: agent-routing
tags: [approver, v0-shadow, protected-paths, abstain, challenger-probe, calibration, size-cap, fork-head]
source_count: 8
---

## TL;DR

The slang/slangpy auto-approver runs in shadow mode against a bundled
`v0-shadow` `APPROVAL_POLICY` (empty mount). A large, well-understood class of
PRs deterministically `ABSTAIN_POLICY` at Step 1 — before the verdict parse
(Step 2) and challenger (Step 3) ever run — and those abstains are *correct
routing to a human*, not misses or false-safes:

- **Protected-path-only PRs always abstain.** `protected_paths` covers
  `.github/**`, `**/*.yml`/`*.yaml`, `**/CMakeLists.txt`, `cmake/**`,
  `external/**`, plus a couple of specific headers. Any PR whose entire net
  footprint matches those globs fails `no_protected_paths`. Run
  `gh pr view <pr> --json files` FIRST; if all paths are protected, the decision
  is fixed regardless of the review — don't burn a Devin run or CodeRabbit poll.
- **Fork-head PRs abstain on `head_provenance`** (`allow_fork_head=false`).
  NVIDIA MEMBERs routinely push to personal forks, so `isCrossRepository=true`
  does NOT imply an untrusted author — `author_trust` passes independently.
- **Size-cap abstains** (`max_total_lines: 400`, `max_files: 30`) route large
  novel-API PRs to a human via `tier_eligible`.
- These classes frequently **merge unchanged at the exact decision commit** —
  that is the system working, not the approver being wrong. Abstains make no
  positive claim and are excluded from agreement scoring by design.

Beyond the deterministic abstains, two live-judgment rules:

- **A reviewable-PR webhook is a snapshot** — the PR may already be
  closed/withdrawn by the time you act. Read `state,closed,mergedAt,mergeCommit`
  before spending harvest+Devin budget.
- **Divergence between the primary review ("no bugs, runs everywhere") and a
  head-current reviewer ("path X skips it") is a hand-to-human signal** — do not
  round up to approve on the primary alone. For gate/enforcement PRs, probe every
  early-return / cache / freshness short-circuit above the new gate.

## The protected-path abstain class: deterministic, un-scoreable, dominant

Under `v0-shadow`, a PR whose changed paths lie entirely within a protected glob
fails the Step-1 `no_protected_paths` clause and yields
`ABSTAIN_POLICY:CLAUSE_FAIL:no_protected_paths`. Because Step 1 short-circuits
before the verdict parse and challenger, and Step 4 early-returns on any ABSTAIN,
**the review verdict, CodeRabbit, and Devin are never consulted** for this class
([protected-path-only routes Step-1](../learnings/1788562917440-approver-clause-gap-protected-path-only-pr-routes-.md)).
The decision is invariant across `synchronize` revisions as long as the footprint
stays protected. The operational rule is to run `gh pr view <pr> --json files`
first: if every path matches a protected glob, the decision is fixed regardless
of the review, so do NOT block on CodeRabbit polling or re-run Devin per
synchronize — still write a minimal honest review doc so `commit_match` is
well-formed, run `eval-clauses.py`, and record one abstain row per settled head.
Set `reviewers_complete=false` / `devin_flag_detail_captured=false` honestly
rather than claiming exhaustiveness. Importantly, the slang#12064
"don't discard an imminent review" rule does NOT apply here — that rule protects
*verdict-driving* signal, and here no verdict is consulted
([protected-path-only routes Step-1](../learnings/1788562917440-approver-clause-gap-protected-path-only-pr-routes-.md)).

Two confirmed merge-clean instances anchor the class. On slang#12888 (a
well-formed CI/identity change, all 15 files under `.github/**`) the abstain vs.
the human merge at the exact decision commit is ABSTAIN-vs-APPROVED, which is
correct routing, not a false-safe; the same PR also risked failing `tier_eligible`
(454 > 400) and production's claude review bot skips CI-only PRs (harvest returns
exit 20)
([CI-only .github abstain](../learnings/1788475081883-approver-calibration-ci-only-github-prs-determinis.md)).
On slangpy#1144 ("Fix warnings") a trusted-author housekeeping PR touching only
`CMakeLists.txt` (a guarded `if(POLICY CMP0177)` opt-in) and a GHA
`upload-artifact@v4→v7` bump, with clean bot+Devin reviews, merged at exactly the
rev-2 decision commit with 0 follow-up commits and 0 formal reviews
([trusted-author fix-warnings abstain](../learnings/1788767903720-approver-calibration-trusted-author-fix-warnings-p.md)).
This is called out as the policy's **dominant cost class**: shadow mode is
*measuring* exactly this protected-path-abstain → merged-as-is rate, and a
persistently high rate is the evidence a narrower rule would need. The candidate
carve-out (a human decision, not the approver's) is guarded CMake-policy
additions and GHA version bumps by trusted authors with clean reviews — with the
caveat that a **major-version bump to a tag that may not exist**
(`upload-artifact@v7`) is exactly what protected-path human review is for
([trusted-author fix-warnings abstain](../learnings/1788767903720-approver-calibration-trusted-author-fix-warnings-p.md)).

## Fork-head abstains: cross-repo ≠ untrusted author

slang#12868 (a MEMBER-authored `workflow_dispatch` smoke workflow) decided
`ABSTAIN_POLICY / CLAUSE_FAIL:head_provenance` (also failing `no_protected_paths`)
and then **merged clean by the author at the exact decided head**
([fork-head + protected-path abstain](../learnings/1788349812725-approver-confirmed-safe-fork-head-protected-path-a.md)).
The key calibration point: the PR head was a cross-repo fork
(`jkiviluoto-nv/slang`) and `allow_fork_head=false`, but NVIDIA members routinely
push branches to personal forks, so `isCrossRepository=true` does NOT imply an
untrusted author — `author_trust` passed (MEMBER) independently. Both hard clauses
short-circuit at Step 1 before the verdict parse, so a clean Devin-only review
(0 bugs/gaps/questions, CI green) never reaches Step 2/3. A fork-head +
protected-path abstain is a **policy-scope hand-off, not a signal the code is
risky**; merges after these abstains are the expected common case — do not
optimize this class toward approval, and do not re-escalate the empty policy mount
per-PR (one standing operator escalation is already tracked)
([fork-head + protected-path abstain](../learnings/1788349812725-approver-confirmed-safe-fork-head-protected-path-a.md)).

## Size-cap abstains: the cap earns its keep on novel large APIs

slangpy#1142 ("Add cluster acceleration structure API", 1283 lines, trusted
MEMBER skallweitNV) decided `ABSTAIN_POLICY:CLAUSE_FAIL:tier_eligible` (1301 > 400
auto-approve cap) and merged at the exact decision commit, self-merged with zero
intervening commits
([size-cap abstain trusted author](../learnings/1788763100874-approver-calibration-size-cap-abstain-on-a-trusted.md)).
An abstain-on-size is a policy deferral, not a code verdict, so the human approval
is neither a false-safe nor a disagreement — the cap routed a large novel-API
change to a human, working as designed. The sharpening signal: large (>400-line)
*new-feature API* PRs from trusted maintainers that are properly capability-gated,
and whose risky path is hardware-gated and unavailable in CI (here cluster AS
behind `Feature.cluster_acceleration_structure`, e2e tests `pytest.skip` without
the device), commonly merge unchanged at the reviewed head. Two nuances: don't
agonize over rounding it toward WOULD_APPROVE, and a **self-merge does NOT
independently validate** the parts green CI can't reach (the GPU-descriptor↔driver
layout, the never-exercised-in-CI cluster build path) — "merged unchanged" means
the author was confident, not that those risks were verified
([size-cap abstain trusted author](../learnings/1788763100874-approver-calibration-size-cap-abstain-on-a-trusted.md)).

## Live-state and challenger discipline (where judgment still matters)

**Webhooks are stale snapshots.** slangpy#1134 was tasked on an
`opened/ready_for_review` webhook but the author had already closed it unmerged
~113s later, before any bot/human review completed — so the required synthesized
review doc could never exist
([stale reviewable-PR webhook](../learnings/1788437163060-approver-procedure-a-reviewable-pr-webhook-can-be-.md)).
In Step 1a (stage the PR at its head), after `gh pr view --json headRefOid`, also
read `state,closed,mergedAt,mergeCommit,reviews`. If `state==CLOSED`:
`mergedAt`/`mergeCommit` set ⇒ merged; both null ⇒ closed-unmerged = author
withdrawal. Either way there is no reviewable target — short-circuit to
`ABSTAIN_POLICY` BEFORE running `collect-reviews.sh`/Devin (which burns
agent-browser budget for a foregone abstain). Do NOT tag it `NO_REVIEW_SIGNAL`
(that infra code means "the pipeline failed" and falsely inflates the infra-defect
gate); use a true-cause code like `PR_CLOSED_UNMERGED_PRE_REVIEW`
([stale reviewable-PR webhook](../learnings/1788437163060-approver-procedure-a-reviewable-pr-webhook-can-be-.md)).

**Gate/enforcement PRs: probe the short-circuit above the gate.** A PR that adds
a version/compat check "on every untrusted path" before deserialization was
confirmed by the primary production review ("runs before any instruction
deserialization; no correctness bugs"), but Devin (head-current) flagged a Bug —
"Freshness checks suppress version diagnostics" at `slang-session.cpp:1364` — and
CodeRabbit independently noted some explicit loading paths can fail without the
required diagnostic
([challenger probe: freshness/cache short-circuit](../learnings/1788565861086-approver-challenger-probe-gate-enforcement-prs-che.md)).
The transferable challenger probe: when a PR inserts a validation gate before an
expensive/unsafe operation, enumerate every `return`/`continue`/early-exit above
the gate (freshness/mtime/hash checks, cache/already-loaded maps, dedup sets,
speculative-vs-explicit branches). For each, ask: if control takes this branch,
does the gate still run? "Reviewers confirmed it runs everywhere" is a *claim*,
not evidence, unless the reviewer walked each early-return. Divergence between the
primary review and a head-current reviewer is a hand-to-human signal — do not
round up to approve on the primary alone
([challenger probe: freshness/cache short-circuit](../learnings/1788565861086-approver-challenger-probe-gate-enforcement-prs-che.md)).

## Codex DECISION_REVIEW as the calibration check on a genuine judgment call

Not every abstain is a Step-1 clause fail; some are earned by resisting the
round-up. On slang#12435 (assoc-type default-value SPIR-V fix, a 5-revision shadow
chain) R5 restructured `getDefaultVal` for a `DeclRefType` to `StructDecl →
member-wise emitMakeStruct; everything else → emitDefaultConstruct` — the most
robust-looking form. The approver initially leaned WOULD_APPROVE; a codex
DECISION_REVIEW flipped it to ABSTAIN on the observation that narrowing the eager
branch *key* from `AggTypeDecl` to `StructDecl`-identity **silently reclassifies
the field-owning siblings** `ClassDecl` and `GLSLInterfaceBlockDecl` into the
deferred path, which drops AST field-initializers and lacks class-type field
recursion. Unable to prove those kinds unreachable ⇒ uncertainty ⇒ ABSTAIN (never
round up)
([getDefaultVal StructDecl abstain vindicated](../learnings/1788353907413-approver-confirmed-getdefaultval-structdecl-only-n.md)).
The abstain was vindicated: the R5 PR was closed unmerged and the fix landed via a
separate merged PR #12712 that gates the member-wise path on the *semantic
property* `isConcreteFieldOwningAggregate` (`hasBody && !aliasedType && field-
bearing`) — keeping Class/GLSLInterfaceBlock member-wise, exactly as flagged.
The reusable probe: when a default-value/aggregate-lowering PR changes a branch key
from a base class to a narrower leaf identity, enumerate EVERY sibling subclass and
ask per-kind whether the reclassification is intended — the right key is almost
always a property, not a single leaf type
([getDefaultVal StructDecl abstain vindicated](../learnings/1788353907413-approver-confirmed-getdefaultval-structdecl-only-n.md)).

**Source learnings (8):**

- [Fork-head + protected-path ABSTAIN on a MEMBER-authored smoke workflow — merged clean](../learnings/1788349812725-approver-confirmed-safe-fork-head-protected-path-a.md) — Cross-repo fork head fails `head_provenance` but MEMBER author passes `author_trust`; merge-after-abstain is expected, not a miss.
- [getDefaultVal StructDecl-only narrowing — R5 abstain vindicated by merged #12712](../learnings/1788353907413-approver-confirmed-getdefaultval-structdecl-only-n.md) — codex DECISION_REVIEW flipped WOULD_APPROVE→ABSTAIN on a leaf-vs-property branch key; merged fix used the field-ownership property, confirming the call.
- [A reviewable-PR webhook can be stale — check live PR state first](../learnings/1788437163060-approver-procedure-a-reviewable-pr-webhook-can-be-.md) — Read `state/closed/mergedAt/mergeCommit` before harvest+Devin; short-circuit a withdrawn PR to ABSTAIN with a true reason code, not `NO_REVIEW_SIGNAL`.
- [CI-only .github/** PRs deterministically ABSTAIN and are un-scoreable](../learnings/1788475081883-approver-calibration-ci-only-github-prs-determinis.md) — Protected-path + size-cap + skipped-bot-review make an entire class un-decidable; correct routing, excluded from scoring.
- [protected-path-only PR routes at Step-1 no_protected_paths — don't spend on review signal](../learnings/1788562917440-approver-clause-gap-protected-path-only-pr-routes-.md) — `gh pr view --json files` first; verdict/CodeRabbit/Devin never consulted; the "don't discard imminent review" rule doesn't apply.
- [Gate/enforcement PRs: check for a freshness/cache short-circuit that bypasses the diagnostic](../learnings/1788565861086-approver-challenger-probe-gate-enforcement-prs-che.md) — Enumerate early-returns above a new gate; primary-vs-head-current reviewer divergence is a hand-to-human signal.
- [Size-cap ABSTAIN on a trusted-author capability-gated new-API PR that merged unchanged](../learnings/1788763100874-approver-calibration-size-cap-abstain-on-a-trusted.md) — `tier_eligible` cap routes large novel APIs to a human; self-merge ≠ verification of hardware-gated paths.
- [Trusted-author "fix warnings" protected-path PRs merge as-is — dominant cost class](../learnings/1788767903720-approver-calibration-trusted-author-fix-warnings-p.md) — Track the protected-path-abstain→merged-as-is rate; a GHA major-version bump to a maybe-nonexistent tag still warrants human eyes.
