---
title: Approver policy loading, clause evaluation, and infra false-abstains
type: concept
group: misc
tags: [pr-approver, eval-clauses, approval-policy, tier-eligible, clause-gap, infra-abstain, shadow-mode]
source_count: 9
---

## TL;DR

The PR-approver's Step-1 deterministic clauses (`eval-clauses.py`) are only as
trustworthy as the policy they loaded and the fetch they ran. Two recurring
failure modes manufacture **false ABSTAINs that look like diligence**:

1. **Wrong policy loaded.** `eval-clauses.py` resolves policy by precedence:
   `--policy` → per-PR staged `<ws>/policy/APPROVAL_POLICY.json` → group mount
   (`/workspace/extra/approver-policy/…`) → bundled `DEFAULT_POLICY` next to the
   script (the strict `v0-shadow`, `allow_fork_head:false`). If you omit
   `--policy`, or a prior turn staged the bundled default per-PR, the strict
   policy silently wins and every fork PR gets a false `head_provenance` FAIL.
   **The tell is `policy_version` in `clauses.json` — read it and confirm it is
   `v0-shadow-wide` before trusting any FAIL.**

2. **Fetch fall-through.** `no_protected_paths`/`tier_eligible` derive changed
   paths from `repos/…/compare/{base}...{sha}`, which 404s on a merge-commit
   head (three-dot merge-base semantics) or transiently — mapping to a false
   `ABSTAIN_INFRA:CLAUSE_UNEVALUABLE`. Recover the file list from `gh pr view
   --json files` and hand-verify; a void fetch is a claim about the request, not
   the world.

The `tier_eligible` line cap (8000) also **trips on golden-baseline
regeneration**, not code complexity: an additive reflection/emit schema change
re-emits every `.expected` file and blows the cap even at +82 real source lines.
Bucket the diff by path suffix and record the source-vs-baseline split so the
human join reads it as a policy artifact, not a code concern.

Finally, the decision procedure has **no authorized state to refute a
fallback-tier 🔴**, so a self-contradicted Devin bug forces ABSTAIN on
merge-ready PRs — a measured, recurring over-conservation.

## Policy resolution and the `policy_version` tell

Two atoms describe the same silent config error from different sessions. The
mechanism: `eval-clauses.py` picks the strict bundled `v0-shadow` policy
(`allow_fork_head:false`, 8 protected globs, 20× tighter caps of 400/30 vs
8000/150) whenever the mounted `v0-shadow-wide` is not explicitly selected.
[The infra-abstain writeup](../learnings/1786975381585-approver-infra-abstain-eval-clauses-silently-falls.md)
traces it to `--policy` defaulting to `DEFAULT_POLICY = HERE/APPROVAL_POLICY.json`;
[the clause-gap writeup](../learnings/1786983996542-approver-clause-gap-a-staged-per-pr-policy-approva.md)
traces the same wrong verdict to a **per-PR staged** `work/<pr>/policy/APPROVAL_POLICY.json`
that a prior turn copied from the bundled default, which outranks the group mount
(precedence tiers `:268-277`). A
[shorter companion rule from another group](../learnings/1786984133437-staging-the-bundled-v0-shadow-default-as-a-per-pr-.md)
states the same: never stage the bundled default; a false `head_provenance` FAIL
on a fork PR under shadow mode is indistinguishable from a real one without the
`policy_version` check. All three prescribe the same post-condition: run with
`--policy /workspace/extra/approver-policy/APPROVAL_POLICY.json`, stage *that*
file (or nothing), and assert `clauses.json.policy_version == v0-shadow-wide`.
The mounted wide policy exists precisely because in shadow mode the human is the
real gate — 91% of decisively-judged abstains were later approved — so a Step-1
terminal FAIL under the wrong policy only destroys measurement signal.

## Fetch fall-through: compare 404 and transient errors

[The compare-404 case](../learnings/1786979161200-approver-clause-gap-eval-clauses-py-compare-api-40.md)
is distinct from the known compare-truncation gap: a **hard 404 on a
merge-commit head** (GitHub's `A...B` three-dot endpoint can 404 when `B` itself
merged the base branch) makes both path clauses `unevaluable` → false
`ABSTAIN_INFRA`. The changed-file set is still fully computable from
`gh pr view --json files` (GitHub computes it vs the merge base). This is the
standing rule "a void fetch is a claim about the request, not the world" — the
same family as the bare-`--paginate` OneCLI-proxy 401 that makes
`collect-reviews.sh` exit 21, and the transient compare 404 noted in the
policy-loading atom above. Recover the datum, hand-verify, stamp the evidence.

The **subagent 400-overflow** is the same principle at the transcript layer:
[a dispatched recall/Devin subagent returning `400 Invalid JSON payload:
unexpected end of data`](../learnings/1787168345473-approver-infra-subagent-400-overflow-is-a-transmit.md)
is a *return-channel* failure, not a work failure — the on-disk artifact
(`review/devin-flags.md`) usually already landed. `ls`/`Read` it before re-running;
if you must retry, cap the reply hard (bounded `head`, write-to-disk, reply < 3KB).

## The `tier_eligible` size cap on golden regeneration

Two paired atoms — [the clause-gap observation](../learnings/1787004502149-approver-clause-gap-tier-eligible-line-cap-trips-o.md)
and [its merge-confirmed data point](../learnings/1787100607706-approver-human-disagreement-tier-eligible-size-cap.md)
— show `tier_eligible` FAILing at 8815 lines > 8000 on slang#12310, where 8444
of those lines are 46 regenerated `.expected` golden baselines and the real
source change is +82 lines, strictly additive (0 deletions / 57 files). The PR
merged **unchanged** at the decided head, refuting the falsifiable reading
("material enough not to merge as-is"). `eval-clauses.py` counts
`additions+deletions` from `pulls/N` scalars with no notion of generated vs
hand-written. Recovery: `git apply --numstat` and bucket by suffix; if the
overage is golden and the source is small+additive+challenger-clean, record the
split so the join reads it as a size-cap policy outcome, not a code concern.
Both atoms flag the same candidate policy refinement (exclude regenerated golden
files from the cap) and note it is not yet acted on.

## The unrefutable fallback-tier 🔴 (structural gap)

[slang#12454](../learnings/1787090028629-approver-clause-gap-a-self-contradicted-fallback-t.md)
was clean, CI-green, and human-MEMBER-approved, yet resolved to
ABSTAIN_POLICY/CRITIQUE_MUSTFIX purely because the sole review signal (Devin, on
the Devin-only fallback tier since production review skips bot `fix/issue-N`
branches) emitted one **demonstrably false 🔴** ("new warning ships without doc
update" — but the diff DOES update two design docs, and it reuses the pre-existing
`E41000` so no new-diagnostic doc applies). Step-3 is absolute — investigation can
only add caution, never upgrade past a 🔴 — so there is no authorized "approver-
verified false-positive" state. The only honest exit is ABSTAIN (BLOCK would be
untruthful, upgrading would be unauthorized). [The merge-join confirmation](../learnings/1787112729987-approver-clause-gap-confirmed-by-merge-slang-12454.md)
scored it: merged unchanged at the exact decided head by the approving MEMBER ⇒
the abstain over-conserved (benign direction, not a false-safe). Both atoms
propose the same fix: an auditable false-positive-refutation state gated through
DECISION_REVIEW, downgrading a fallback 🔴 to advisory only when the refutation is
established from diff/source at the pinned head with file:line evidence.

## Source learnings (9):

- [eval-clauses silently falls back to the STRICT bundled policy](../learnings/1786975381585-approver-infra-abstain-eval-clauses-silently-falls.md) — omitting `--policy` loads the strict `v0-shadow` default; read `policy_version` from `clauses.json` before trusting a FAIL.
- [eval-clauses compare API 404s on a merge-commit head](../learnings/1786979161200-approver-clause-gap-eval-clauses-py-compare-api-40.md) — merge-commit head 404s the compare endpoint → false ABSTAIN_INFRA on the two path clauses; recover file list from `gh pr view --json files`.
- [A staged per-PR policy overrides the group mount](../learnings/1786983996542-approver-clause-gap-a-staged-per-pr-policy-approva.md) — a leftover `work/<pr>/policy/APPROVAL_POLICY.json` (bundled default) outranks the mount and flips fork PRs to a false `head_provenance` FAIL.
- [Staging the bundled v0-shadow default flips fork PRs to false abstain](../learnings/1786984133437-staging-the-bundled-v0-shadow-default-as-a-per-pr-.md) — companion rule: never stage the bundled default; a false fork abstain is indistinguishable from a real one without the check.
- [tier_eligible line-cap trips on golden-baseline regeneration](../learnings/1787004502149-approver-clause-gap-tier-eligible-line-cap-trips-o.md) — additive schema PRs re-emit every `.expected` and blow the 8000-line cap; bucket the diff and record the source-vs-baseline split.
- [tier_eligible size-cap over-abstained on clean additive PR (12310 merged unchanged)](../learnings/1787100607706-approver-human-disagreement-tier-eligible-size-cap.md) — merge-confirmed data point: cap fired on 46 golden baselines, +82 real source lines, merged as-is.
- [Subagent 400-overflow is a transmit failure](../learnings/1787168345473-approver-infra-subagent-400-overflow-is-a-transmit.md) — a `400 unexpected end of data` from a subagent is a return-channel failure; the on-disk artifact usually landed — read it, don't re-run.
- [A self-contradicted fallback-tier 🔴 forces ABSTAIN — no refutation state](../learnings/1787090028629-approver-clause-gap-a-self-contradicted-fallback-t.md) — Devin's false "missing docs" 🔴 forced abstain on a clean, human-approved PR; propose an auditable false-positive state.
- [CONFIRMED by merge: 12454 abstain-on-refuted-🔴 over-conserved](../learnings/1787112729987-approver-clause-gap-confirmed-by-merge-slang-12454.md) — merged unchanged at the decided head; measurable cost of the missing refutation escape hatch.
