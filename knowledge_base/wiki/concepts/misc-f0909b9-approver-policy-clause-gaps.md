---
title: "Slang/SlangPy PR-approver: policy mount, clause gaps, and scope determination"
type: concept
group: misc
tags: [approver, v0-shadow, tier_eligible, protected_paths, out_of_scope, abstain_policy, clause-gap, ledger]
source_count: 17
---

## TL;DR

The slang/slangpy PR-approver decides in a strict sequence: Step 1 deterministic
eligibility clauses → Step 2 verdict parse → Step 3 adversarial challenger. A
Step-1 clause FAIL is an *early return* that records `ABSTAIN_POLICY` and never
reaches verdict-parse or challenger. Because the approver-policy mount is empty on
the host, the bundled `v0-shadow` policy is in effect, which trusts only
COLLABORATOR/MEMBER/OWNER and sets `allow_fork_head:false`. That produces four
recurring, by-design abstains that are NOT code concerns and are excluded from
agreement scoring:

- **author_trust** — bot authors (`nv-slang-bot[bot]`, CONTRIBUTOR) fail.
- **tier_eligible** — a 400-line / 30-file cap that counts raw `additions+deletions`
  with no notion of mechanical vs. substantive churn; mechanical renames,
  test-migrations, and any real multi-backend feature trip it.
- **head_provenance** — any fork head (very common: NVIDIA MEMBERs push feature
  branches to personal forks) abstains regardless of merits.
- **no_protected_paths** — any `.github/**`, `CMakeLists.txt`, `*.yml`,
  `external/**` gitlink change fails.

Key disciplines: a size-cap or protected-path FAIL short-circuits *before* a 🔴
bug in the review is verified, so BLOCK recall on oversized/protected PRs is
structurally zero — record the reported bug in `challenger.surfaced_for_human`.
Never fabricate a clause input (a manufactured `commit_match=pass` is a false
attestation; use `null`/UNEVALUABLE). Repo-class/scope is *prior to* the clause
pipeline: website/blog/docs and branch-sync/agent-framework PRs get
`ABSTAIN_POLICY:OUT_OF_SCOPE`, never downgraded to the infra family. All of these
are policy reasons (system working as intended), not infra — they must not burn
the infra-abstain gate. Fixes to the caps are BAR questions for a human policy
owner; the approver never self-widens.

## The empty policy mount and the bundled fallback

The approver reads its `APPROVAL_POLICY.json` from a host mount
(`/ephemeral/approver-policy` → container `approver-policy`, readonly). When the
host *source* directory is missing, the mount is present but empty, and
eval-clauses silently falls back to the bundled `v0-shadow` policy — which trusts
only COLLABORATOR/MEMBER/OWNER. Under the intended `v0-shadow-wide`, author_trust
would pass for bot/CONTRIBUTOR authors; under the fallback it spuriously FAILs,
fleet-wide, for *every* decision until the operator re-provisions the file
([approver policy mount source missing](../learnings/1788380182368-approver-policy-mount-source-missing-all-approvals.md)).
Detection: `ncl groups config get --id <approver-gid>` shows the mount declared,
but the Orchestrator can `ls /workspace/extra/ephemeral/approver-policy/` to see
the source is empty. This empty-mount state is a *standing OPEN* escalation — do
not re-escalate per-PR.

## The four by-design clause fails

**author_trust (bot authors).** A purely mechanical public-API rename by
`nv-slang-bot[bot]` (28 files/914 LOC) fails both author_trust *and* tier_eligible,
yet merges unchanged
([mechanical bot API-rename PRs](../learnings/1788384932229-approver-clause-gap-mechanical-bot-api-rename-prs-.md)).
Test-only fixer PRs that reconcile a test against a concurrently-merged
diagnostic (a semantic merge conflict) also fail author_trust and abstain, though
Devin + the human clear them
([test-only PRs reconciling a test vs a new diagnostic](../learnings/1788474978105-approver-calibration-test-only-prs-reconciling-a-t.md)).

**tier_eligible (raw-LOC size cap).** The cap sums `additions+deletions` over all
changed files with no substantive/mechanical distinction. A "Normalize GLSL
source language selection" PR (2600 lines / 232 files, dominated by ~200
mechanical `-allow-glsl → -lang glsl` test migrations) abstains as hard as 2600
lines of new compiler logic — even after the bot review converged to ✅ clean, so
the approver produced *zero* agreement signal
([tier_eligible caps count mechanical churn](../learnings/1788390252575-approver-clause-gap-tier-eligible-line-file-caps-c.md)).
Large trusted-author multi-backend feature PRs (51 files / ~1.6k lines across
D3D12+Vulkan+CUDA) structurally fail tier_eligible and usually no_protected_paths,
and routinely merge after author iteration
([large trusted-author cross-backend feature PRs](../learnings/1788464479528-approver-calibration-large-trusted-author-cross-ba.md)).

**head_provenance (fork heads).** Even a trusted MEMBER pushing to their own
personal fork of shader-slang/slang abstains identically to an external fork.
Confirmed repeatedly by outcome joins where the PR merged *unchanged* at the exact
decision commit: a coverage-counter refactor
([v0-shadow fork-head + size-cap abstain merged unchanged](../learnings/1788432516027-approver-calibration-v0-shadow-fork-head-size-cap-.md)),
a clean converged PR from jvepsalainen-nv
([fork-head clean PRs from trusted MEMBERs merge](../learnings/1788435835010-approver-human-disagreement-fork-head-clean-prs-fr.md)),
and a doc-only bindless-enum-name fix
([fork-head abstain on slang#12882 merged clean](../learnings/1788851074769-approver-clause-gap-outcome-join-fork-head-abstain.md)).
These joins are the only instrument that catches a correct-policy-but-over-strict
clause: they compound evidence for a policy that gates on author_trust rather than
raw head provenance. A fourth join sharpens the *combination*: slang#12940 (`ci: fix
nightly Sascha test by looking up build artifact by name`) failed Step-1 on BOTH
`head_provenance` (fork `jvepsalainen-nv/slang`, `isCrossRepository:true`) and
`no_protected_paths` (its only file, `.github/workflows/nightly-slang-sascha-test.yml`,
matches both `.github/**` and `**/*.yml`), then merged UNCHANGED at the exact second
decision commit `0fa2224` by a MEMBER. The two fails are NOT equivalent: the fork-head
fail is a mount artifact (under a proper `v0-shadow-wide` mount a trusted MEMBER's own
fork would pass), but the protected-path fail is a **genuine** policy fail that survives
even a proper mount — a CI-workflow-file change can alter CI/secrets/permissions and
must have a human look. A trusted-MEMBER PR whose entire diff is a
`.github/workflows/*.yml` CI-plumbing fix is a recurring shape that merges cleanly after
human review, so repeated ABSTAINs on it are the system working as intended, not a
calibration problem — do not treat the accumulating abstain rate on fork-head/
protected-path PRs as a miss to optimize away. This extends the same "CI-only
`.github/**` PRs are un-scoreable under v0-shadow" class seen in #12888 (same-repo
CI-only, merged) and #12898 (fork `.github/` doc); the new wrinkle is the fork-head +
workflow-YAML pairing. (Mechanics: on a `pr_merged` event the human outcome is
host-joined from GitHub — no `record_human_verdict` tool is exposed to the approver — so
the approver's job on a merge is the calibration learning, not a verdict-write.)
[[approver/human-disagreement] Fork-head CI-workflow-only PR by trusted MEMBER merged unchanged at the abstain commit — by-design ABSTAIN, not a miss](../learnings/1788943265623-approver-human-disagreement-fork-head-ci-workflow-.md)

**no_protected_paths (`.github/**` etc.).** Board-sync `GITHUB_TOKEN` write-grant
PRs (all `.github/workflows/*.yml`) FAIL deterministically and short-circuit at
Step 1 before the challenger, correctly keeping maintainer eyes on
workflow-permission YAML — even on a fully clean automated read. A useful nuance:
such grants can be *forward-provisioning / inert* until an upstream reusable
workflow consumes them, so "looks safe because it does nothing yet" is expected,
not reassuring
([board-sync GITHUB_TOKEN write-grant PRs](../learnings/1788382245268-approver-confirmed-board-sync-github-token-write-g.md)).

## Sequencing: a size-cap FAIL hides a real bug from BLOCK

Because Step-1 clause FAIL early-returns, a 400-line-plus PR with a genuine 🔴
(e.g. signed-overflow UB on git tag names) records `ABSTAIN_POLICY:tier_eligible`,
*not* BLOCK — verdict-parse (which maps 🔴→BLOCK) and the challenger (which
*verifies* the bug) never run. BLOCK recall on oversized/protected PRs is
structurally zero. The right move: record the reported bug in
`challenger.surfaced_for_human` so the abstain row still carries the signal a
human must address
([size-cap FAIL short-circuits before verdict parse](../learnings/1788393110920-approver-clause-gap-size-cap-tier-eligible-fail-sh.md)).

## Never fabricate a clause input at a short-circuit

At a Step-1 short-circuit it is tempting to set the review doc's `commit_id` = the
pinned head so `commit_match` passes — that is a FALSE attestation that "a review
covered this commit." If no head-current bot review exists and Devin was skipped,
set `commit_id: null`/`diff_hash: null` so `commit_match` reports UNEVALUABLE; the
definite policy FAIL governs and the unevaluable is moot. Companion discipline:
when a standing operational ruling is retracted, fix BOTH the note body AND its
index one-liner in the same edit — a stale index summary is a latent
wrong-decision source. And record AFTER the critique gate even for ABSTAIN, since
the delivery gate can alter the reason_code post append-only write
([don't manufacture commit_match at a Step-1 short-circuit](../learnings/1788450370082-approver-clause-gap-at-a-step-1-short-circuit-don-.md)).

## Scope / OUT_OF_SCOPE is prior to the clause pipeline

The mechanical clauses carry no repo-class predicate, so on a non-compiler repo
they either pass vacuously or return UNEVALUABLE for wrong-domain reasons (no bot
review pipeline; a Pages CI build). Determine class FIRST from repo name / changed
paths:

- **Website/blog/docs** (`*.github.io` + `_posts/*.md`) → `OUT_OF_SCOPE:website-content`,
  regardless of whether clauses PASS or come back UNEVALUABLE, and regardless of an
  empty harvest — never downgrade to `CLAUSE_UNEVALUABLE`/`NO_REVIEW_SIGNAL`, which
  would spuriously inflate the infra-abstain rate
  ([website-content OUT_OF_SCOPE governs even when clauses UNEVALUABLE](../learnings/1788458821537-approver-clause-gap-website-content-out-of-scope-g.md)).
- **Branch-sync / agent-framework PRs.** A `Sync nv-slangpy with nv-main`
  bot-authored PR into `slang-coworkers/nanoclaw` is doubly out of scope: the repo
  is the approver's *own harness* (COI — deciding it = deciding on my own decision
  instrument) and the class predicate fires before clauses
  ([branch-sync PR into the approver's own framework repo = OUT_OF_SCOPE + COI](../learnings/1788878652241-approver-clause-gap-branch-sync-pr-into-the-approv.md),
  [nanoclaw branch-sync PRs are OUT_OF_SCOPE like changelog-docs](../learnings/1788878715579-approver-clause-gap-nanoclaw-branch-sync-prs-are-o.md)).
  Do NOT stretch an unrelated clause (`tier_eligible`) to launder a scope/COI
  abstain into a clause fail. `record_decision` accepts `OUT_OF_SCOPE:*` and a
  cross-domain `repo`.

## Synchronize handling: base-merge vs. real revision, and the harvest race

On a `synchronize`, `gh api .../compare/<prevHead>...<newHead>` uses merge-base
semantics, so a branch that merged master returns ALL of master's delta and drowns
the (possibly zero) PR-owned change. Use `gh pr view --json files` for the real
changed-file set and filter the compare to the flagged files — an empty patch
there proves the logic is byte-identical, so a base-merge addresses no prior
concern; and neither a base-merge nor a human APPROVAL clears an unaddressed
correctness flag or red downstream CI
([diff the PR's OWNED files to tell a base-merge from a real revision](../learnings/1788391804224-approver-challenger-on-a-synchronize-diff-the-pr-s.md)).
A *merge-only* synchronize (new head = "Merge branch 'main'…", `gh pr diff`
byte-identical to the prior revision) still needs a FRESH ledger row keyed to the
new commit_sha; confirm the diff is identical AND re-verify the challenger's
load-bearing facts at the new ref (main may have changed surrounding code) —
CodeRabbit marks it `target_branch_merge_carry_forward` with `coveredCommitId = new
head`
([a merge-only synchronize still needs a fresh ledger row](../learnings/1788780675857-approver-infra-a-merge-only-synchronize-pr-diff-un.md)).
The harvest `pending_bot()` only inspects the *pinned* head's status/check-runs, so
immediately after a synchronize CodeRabbit's pending status still sits on the
*previous* head and `collect-reviews.sh` returns exit 20 ("none pending") while a
secondary review is imminent; read the prior head's CodeRabbit status and the
"review in progress" summary marker before accepting an exit-20 skip on a
decision-bearing PR
([harvest pending_bot checks only the pinned head](../learnings/1788562907093-approver-clause-gap-harvest-pending-bot-checks-onl.md)).

## The consistent posture

All four clause fails and both OUT_OF_SCOPE classes are POLICY reasons: report
them cleanly as "code may be clean; deferring to a human on policy," never as
latent risk. Abstains are excluded from agreement scoring, so there is no
false-safe risk — the merges just accumulate evidence for a human-owned policy-bar
escalation (define trust for automated PRs; make tier_eligible risk-aware; gate
fork heads on author_trust). The approver never self-widens the derivation.

**Source learnings (17):**

- [Approver policy mount source missing → all approvals fall back to bundled default](../learnings/1788380182368-approver-policy-mount-source-missing-all-approvals.md) — empty host mount silently swaps v0-shadow-wide for v0-shadow, spuriously failing author_trust fleet-wide.
- [board-sync GITHUB_TOKEN write-grant PRs: protected-path ABSTAIN is correct](../learnings/1788382245268-approver-confirmed-board-sync-github-token-write-g.md) — no_protected_paths short-circuits `.github/**` grants; note whether the grant is inert-until-upstream (forward-provisioning).
- [Mechanical bot API-rename PRs trip author_trust + tier_eligible yet merge unchanged](../learnings/1788384932229-approver-clause-gap-mechanical-bot-api-rename-prs-.md) — raw-LOC cap conflates mechanical breadth with logic density; a BAR question for the policy owner.
- [tier_eligible line/file caps count mechanical test-migration churn as substantive](../learnings/1788390252575-approver-clause-gap-tier-eligible-line-file-caps-c.md) — a 2600-line/232-file GLSL-normalize PR abstains despite converging to clean; the approver structurally can't score this class.
- [Size-cap (tier_eligible) FAIL short-circuits before verdict parse](../learnings/1788393110920-approver-clause-gap-size-cap-tier-eligible-fail-sh.md) — an oversized PR with a verified 🔴 records ABSTAIN, not BLOCK; put the bug in `challenger.surfaced_for_human`.
- [v0-shadow fork-head + size-cap abstain fired on a MEMBER-authored PR that merged unchanged](../learnings/1788432516027-approver-calibration-v0-shadow-fork-head-size-cap-.md) — head_provenance is blunt for trusted MEMBERs' own forks; author-deferred documented gaps are not merge-blockers.
- [Fork-head clean PRs from trusted MEMBERs merge — head_provenance abstain is a provenance artifact](../learnings/1788435835010-approver-human-disagreement-fork-head-clean-prs-fr.md) — spend zero challenger effort on the fork clause; note the merits may be clean.
- [At a Step-1 short-circuit, don't manufacture commit_match; keep index/body in sync](../learnings/1788450370082-approver-clause-gap-at-a-step-1-short-circuit-don-.md) — honest UNEVALUABLE beats a fake PASS; record after the critique gate even for ABSTAIN.
- [Website-content OUT_OF_SCOPE governs even when mechanical clauses are UNEVALUABLE](../learnings/1788458821537-approver-clause-gap-website-content-out-of-scope-g.md) — determine class from repo/path FIRST; never downgrade to the infra reason family.
- [Large trusted-author cross-backend feature PRs that ABSTAIN only on size/protected-path caps routinely merge](../learnings/1788464479528-approver-calibration-large-trusted-author-cross-ba.md) — a red CI matrix on a fresh feature PR is a transient the author resolves; ABSTAIN via early-return is correct and cheap.
- [Outcome join: fork-head abstain on slang#12882 merged clean & unchanged](../learnings/1788851074769-approver-clause-gap-outcome-join-fork-head-abstain.md) — evidence that allow_fork_head:false over-abstains for trusted MEMBER authors; log each clean-merge, don't re-escalate the mount.
- [fork-head + `.github/workflows/*.yml` PR by a trusted MEMBER (slang#12940) merged unchanged at the abstain commit: by-design ABSTAIN, not a miss; the protected-path fail is genuine (survives a proper mount) while the fork-head fail is a mount artifact — don't optimize away the accumulating abstain rate on this class.](../learnings/1788943265623-approver-human-disagreement-fork-head-ci-workflow-.md)
- [Branch-sync PR into the approver's own framework repo = OUT_OF_SCOPE + COI, abstain pre-clause](../learnings/1788878652241-approver-clause-gap-branch-sync-pr-into-the-approv.md) — deciding on the harness that produces the review signal is a conflict of interest; short-circuit before clauses.
- [nanoclaw branch-sync PRs are OUT_OF_SCOPE like changelog-docs — scope predicate is prior](../learnings/1788878715579-approver-clause-gap-nanoclaw-branch-sync-prs-are-o.md) — extends the OUT_OF_SCOPE class to repo-sync PRs in the infra fork; absence of a bot review there is by-design, not an infra gap.
- [harvest pending_bot() checks only the pinned head — misses CodeRabbit still pending on the pre-synchronize head](../learnings/1788562907093-approver-clause-gap-harvest-pending-bot-checks-onl.md) — exit-20 during a synchronize race can discard an imminent review; read the parent head's status + the in-progress summary marker.
- [A merge-only synchronize (PR diff unchanged) still needs a fresh ledger row](../learnings/1788780675857-approver-infra-a-merge-only-synchronize-pr-diff-un.md) — detect via identical `gh pr diff` + CodeRabbit `target_branch_merge_carry_forward`; re-verify challenger facts at the new ref.
- [On a synchronize, diff the PR's OWNED files to tell a base-merge from a real revision](../learnings/1788391804224-approver-challenger-on-a-synchronize-diff-the-pr-s.md) — raw compare drowns the PR change in master's delta; neither base-merge nor human APPROVAL clears an open correctness flag or red downstream CI.
