---
title: "Approver Calibration: Join Scoring, Abstain Vindication, and Merge-Signal Reading"
type: concept
group: agent-infra
tags: [approver, calibration, join-scoring, abstain, human-agreement, supersession, docs-churn, cwe]
source_count: 8
---

## TL;DR

How to score an approver decision against what humans later did to the PR — and how not to
let a merge, an approval, or a "trivial diff" fool the scoring.

- **An approval joins to ITS OWN commit, never to the nearest decision row.** When the
  approved head ≠ your decided head, diff the interval FIRST — the follow-up commits are the
  difference between your read and the shipped change.
- **Score an ABSTAIN against the falsifiable reading "material enough not to merge as-is,"
  not against "a human must look; a human looked."** A head that drew corrective commits was
  not merged as-is — the abstain was material and correct even if the final PR is approved.
- **READ THE CLOSE REASON on any closed-unmerged join.** A design-supersession close
  ("another solution", "closing in favor of #N", a sibling PR merged same-day) is orthogonal
  to code mergeability and carries NO signal — but see the correction below.
- **When your read conflicts with an explicit skill mapping, FOLLOW the mapping and flag
  your interpretation as a PROPOSAL** — you don't get to reclassify a join to no-signal on
  your own authority. The governing mapping is merged⇒APPROVED, closed-unmerged⇒
  CHANGES_REQUESTED-equivalent.
- **A self-merge with no human review is APPROVED-equivalent for joining but weak evidence**
  — record that no reviewer validated the safety you couldn't.
- **Enumerate every failure mode a finding names ("X OR Y") and clear each separately.**
  "Not-widened" is per-failure-mode, not per-PR: a UB-fix that stops an early crash can route
  input deeper into a pre-existing latent bug.
- **A "trivial" docs/tooling PR is not a license to relax challenger rigor.** Commands,
  install paths, URLs, package names, version pins are executable claims CI-green and a first
  bot pass routinely don't verify — actually resolve them (does the formula/URL exist?).
- **A `docs/generated/**`-only diff over the size cap is the expected shape, not a smell** —
  the `tier_eligible` cap is a churn proxy, not a risk proxy.
- **A CWE-522 / persist-credentials finding on a CI workflow is neither auto-blocking nor
  auto-ignorable** — judge it by token scope (`permissions:`), new-vs-pre-existing exposure,
  trigger controllability, and runner reuse.

## Synthesis

### The join rule: an approval belongs to its own commit

The single most important calibration mechanic is that a human action joins to the specific
commit it was made on. A "clean approval ⇒ my abstain was over-cautious" inference is the
false-safe the join rule guards against, because the approval is usually about a different,
fixed revision. On slang#12439 the decided head drew three corrective commits (two addressing
the exact gaps the abstain named) before a human approved a head three commits later — so the
abstain was material and correct despite the approved final state; the interval
(`gh api .../compare/<mine>...<approved>`) showed the follow-up commits naming the gaps
([an ABSTAIN is vindicated by the interval diff, not refuted by a later approval](../learnings/1786582901413-approver-human-agreement-an-abstain-is-vindicated-.md)).
Score against the falsifiable reading — "material enough not to merge as-is" — not against "a
human must look; a human looked." The corollary reaffirmed elsewhere: a byte-identical fix
hunk to a previously-approved head does NOT carry the approval forward, because a surrounding
master-merge can change both the delivered scope (reverted deletions) and the world (a sibling
fix landing) ([ABSTAIN(OPEN_GAP) on a stale-suppression-list merge gap](../learnings/1787646599438-approver-human-agreement-abstain-open-gap-on-a-sta.md)).

### Reading a closed-unmerged join — and the discipline of deferring to the mapping

The taxonomy question "does closed-unmerged mean CHANGES_REQUESTED?" produced a learning and
then its own correction, which together are the durable rule. The initial insight
(slang-rhi#846): a maintainer closed the PR with "I've arrived at another solution to this,
see #849" (which merged the same day), raising ZERO correctness objections — a
**design-supersession** close orthogonal to whether the superseded code was mergeable, and
arguably a third join bucket (`closed-superseded = no-signal`) beyond merged(=approved) and
closed(=changes-requested) ([closed-unmerged does NOT always mean CHANGES_REQUESTED](../learnings/1787963451612-approver-human-disagreement-closed-unmerged-does-n.md)).
The correction, caught by the codex OUTPUT_REVIEW gate citing SKILL.md, is the governing rule:
that reframe is a PROPOSAL, not operative — the skill explicitly mandates
merged⇒APPROVED-equivalent, closed-unmerged⇒CHANGES_REQUESTED/REJECTED-equivalent, so the
WOULD_APPROVE must be recorded as a human DISAGREEMENT, and "absence of a stated objection is
NOT proof of defect absence" (CodeRabbit had posted 2 actionable comments)
([correction to the supersession-close learning](../learnings/1787964032775-approver-human-disagreement-correction-to-the-supe.md)).
**When your read conflicts with an explicit skill mapping, follow the mapping and flag your
interpretation as a proposal for policy owners — never encode your preferred interpretation as
though it overrides the procedure.** Still, READ THE CLOSE REASON before mapping (grep for
"another solution", "superseded by #N", "closing in favor of"), and score a supersede-close as
weak/ambiguous, not clean vindication. Two more join-scoring qualifiers: an unchanged author
self-merge with no human review is APPROVED-equivalent for joining but weak evidence
([slang-rhi UB-fix that widens a container's input set](../learnings/1786614164733-approver-human-disagreement-slang-rhi-ub-fix-that-.md)),
and a close that converges with your own finding from a different angle (the human landed on
the same stale-suppression-list artifact you flagged) is a positive datapoint that counting a
PR's reverted deletions surfaces real problems ([stale-suppression-list merge gap](../learnings/1787646599438-approver-human-agreement-abstain-open-gap-on-a-sta.md)).
Add a supersession check to Step-0/challenger for any PR that "Fixes" a named issue: is the
issue already addressed or racing a sibling PR (`gh issue view <N>` + `gh pr list --search`)?

### Multi-mode findings: clear every mode, and "not-widened" is per-mode

A near-miss on slang-rhi#838 shows the failure of clearing one mode of a multi-mode finding.
CodeRabbit's sole Major named two failure modes ("dereference an invalid layout OR perform
invalid cleanup"); the draft WOULD_APPROVE cleared only the downstream-deref half as
"pre-existing / not-widened," and the DECISION_REVIEW gate caught that the cleanup mode was
untraced ([slang-rhi UB-fix that widens a container's input set](../learnings/1786614164733-approver-human-disagreement-slang-rhi-ub-fix-that-.md)).
The transferable rule: enumerate every failure mode a finding names and clear each separately,
because a "pre-existing / unchanged-code" clearance is scoped to the mode you actually trace
and does NOT transfer to a co-located second mode. Crucially, **"not-widened" is per-failure-
mode, not per-PR**: the very fact that made the deref harmless (structured buffers now reach
`createForElementType`, having crashed earlier before) is what WIDENS the input set reaching
the buggy cleanup path — a UB-*fix* that stops an early crash can route input deeper into a
pre-existing latent bug whose LINES are untouched. Keep the reachability claim conditional when
you can only prove entry, not the full trigger. A cheap-clear of a reviewer flag aimed at the
fix under review is the approver's most-punished class.

### Churn is not risk; a trivial diff is not a license to relax rigor

Two learnings correct opposite over-reactions to diff shape. On the low-risk side,
`tier_eligible` (the size cap) is a **churn proxy, not a risk proxy**: a
`docs/generated/**`-only regeneration sweep is inherently 12–14k lines yet near-zero merge
risk, so its ABSTAIN_POLICY:CLAUSE_FAIL:tier_eligible is correct procedure (shadow mode never
auto-approves) but carries zero code-risk signal — don't read the abstain as "concerning," and
on a churn-driven abstain that will recur on every `synchronize`, tell the orchestrator once
that it re-abstains identically ([large generated-docs sweeps trip tier_eligible](../learnings/1786540358343-approver-clause-gap-large-generated-docs-sweeps-ch.md)).
On the deceptively-low-risk side, a "trivial" 2-line docs/tooling PR is NOT a license to relax
challenger rigor: on slang#12601 a newly-added `brew install cpp-linter/tap/clang-format@17`
referenced a NONEXISTENT Homebrew formula (verified via raw-formula 404 + a 200 control), the
human made exactly that fix before merge, and the challenger's ABSTAIN was vindicated — docs
containing commands, install paths, URLs, package names, or version pins are executable claims
that CI-green and a first bot pass routinely don't verify, so reach for actual resolution on any
such edit however small ([challenger ABSTAIN vindicated on a "trivial" docs PR](../learnings/1788273396529-approver-human-agreement-challenger-abstain-vindic.md)).
The same merge confirmed that an ABSTAIN_POLICY:CLAUSE_FAIL (protected path) followed by a human
MEMBER merging is the shadow gate working as designed (abstains are excluded from agreement
scoring), and that per-revision discipline (a `synchronize` adding real content is NOT a
review-neutral master-merge) is what surfaces a bug three revisions in.

### Security findings on CI workflows: judge by factors, not presence

A CWE-522 / persist-credentials finding on a CI workflow that merges+builds untrusted PR code
is neither auto-blocking nor auto-ignorable. Judge it by four factors: token scope (read
`permissions:` first — `contents: read` means the persisted `GITHUB_TOKEN` can't push code, the
strongest cheap mitigator CodeRabbit didn't weight); new-vs-pre-existing exposure (the job
already built untrusted code with the same token — the new step doesn't change the class);
trigger controllability (the PR number came from a Slang-master-set variable, so triggering
needs trusted merge access); and runner reuse (self-hosted reused workspaces amplify persisted-
state risk). For the approver this stays an ABSTAIN (protected-path → human), and the maintainer
merging at the exact decided head after a threat-model rebuttal confirms the routing is
well-calibrated — a genuine security question went to the human holding merge-access context
([CI workflow that merges+builds an untrusted PR: CWE-522](../learnings/1788905666798-approver-calibration-ci-workflow-that-merges-build.md)).
A future variant with broad `permissions:`, an attacker-controllable trigger, or genuinely-new
exposure is the higher-risk case to flag harder.

**Source learnings (8):**
- [An ABSTAIN is VINDICATED by the interval diff, not refuted by a later approval](../learnings/1786582901413-approver-human-agreement-an-abstain-is-vindicated-.md) — an approval joins to its own commit; diff the interval when approved head ≠ decided head; a supervisor "spoke last" nudge fires on an approval, which is not an ask.
- [slang-rhi UB-fix that widens a container's input set can newly expose a pre-existing bug](../learnings/1786614164733-approver-human-disagreement-slang-rhi-ub-fix-that-.md) — enumerate every failure mode of a finding; "not-widened" is per-mode not per-PR; a self-merge with no review is weak evidence.
- [ABSTAIN(OPEN_GAP) on a stale-suppression-list merge gap confirmed by close](../learnings/1787646599438-approver-human-agreement-abstain-open-gap-on-a-sta.md) — add a supersession check to Step-0; a byte-identical hunk doesn't carry approval forward when master moved.
- [Closed-unmerged does NOT always mean CHANGES_REQUESTED — a design-supersession close](../learnings/1787963451612-approver-human-disagreement-closed-unmerged-does-n.md) — read the close reason; a supersede-close is orthogonal to mergeability (proposed as a third join bucket).
- [CORRECTION — the supersession-close learning is a PROPOSAL; the skill mapping still governs](../learnings/1787964032775-approver-human-disagreement-correction-to-the-supe.md) — follow the explicit mapping and flag your read as a proposal; absence of a stated objection isn't proof of defect absence.
- [large generated-docs sweeps chronically trip tier_eligible; the size cap is churn, not risk](../learnings/1786540358343-approver-clause-gap-large-generated-docs-sweeps-ch.md) — a `docs/generated/**`-only over-cap diff is the expected shape; a path-aware cap would recover signal.
- [Challenger ABSTAIN vindicated on a "trivial" 2-line docs PR](../learnings/1788273396529-approver-human-agreement-challenger-abstain-vindic.md) — docs commands/URLs/versions are executable claims; resolve them; per-revision discipline catches a bug three revisions in.
- [CI workflow that merges+builds an untrusted PR: CWE-522 persist-credentials is blocking only under specific factors](../learnings/1788905666798-approver-calibration-ci-workflow-that-merges-build.md) — judge by `permissions:` scope, new-vs-pre-existing, trigger controllability, runner reuse; abstain→human is well-calibrated.
