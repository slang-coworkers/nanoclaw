---
title: PR-approver CI clauses and calibration — the ci_green_on_sha check-runs blind spot
type: concept
group: ci-tooling
tags: [pr-approver, ci-green-on-sha, check-runs, status-api, calibration, abstain, clause-gap]
source_count: 9
---

## TL;DR

- **`ci_green_on_sha` reads the legacy combined **Status API** (`/commits/{sha}/status`), which is blind to GitHub **Actions check-runs** (`/commits/{sha}/check-runs`).** On slang/slang-rhi/slangpy the real build/test matrix is check-runs; the only Status-API contexts are `license/cla` + `CodeRabbit`.
- Consequences: the clause can report `pass` while builds are **red**, **in_progress**, or **skipped**. A tiny combined-status total (1–2) is the tell that it speaks for nothing.
- **Directional safety:** in shadow mode the clause only ever gates an *abstain*, never a positive approve — so an over-lenient CI clause can at worst let a decision proceed to the challenger, never auto-approve on red CI. But it is NOT a reliable "all required checks green" gate.
- **Challenger backstop (mandatory on these repos):** independently read `gh api repos/<r>/commits/<sha>/check-runs --jq '.check_runs[]|select(.conclusion=="failure")|.name'` (or `gh pr checks <pr>`). A red Actions matrix on an otherwise-clean PR is a decision-mover → ABSTAIN.
- **Proposed fix (needs human sign-off):** union check-runs into the clause — any required check-run in {failure, timed_out, cancelled, action_required} ⇒ FAIL; in_progress/queued ⇒ unevaluable/pending.
- The host `APPROVER_CI_GATE` normally parks reviewable PRs until required CI is green, covering the blind spot; the gap only bites with the gate OFF (legacy rapid re-wakes).
- **Calibration:** protected-path (`.github/**`, `**/*.yml`, `**/CMakeLists.txt`) and size-cap (`tier_eligible`) FAILs are *deterministic* ABSTAIN_POLICY by design — excluded from agreement scoring. A subsequent clean merge at the reviewed commit is NOT evidence the abstain was too conservative.
- A **new CI lint-guard PR** merges safely when the guard is live-verified (positive control), master is clean under it, it's wired into a real gate, and the scope boundary is right — spend challenger budget on the positive control + review-signal head-currency, not diff size.
- Draft-era "won't build until #PREREQ lands" caveats go **stale** — re-verify prerequisites, body, and baseRefName on the *pinned head*. An all-**SKIPPED** CI workflow gives ZERO executed-build signal; flag it, don't infer buildability.

## The core defect: ci_green_on_sha is blind to Actions check-runs

Five independent atoms across three repos record the same clause imprecision, so it is a
settled, reproducible defect rather than a one-off. `eval-clauses.py`'s `ci_green_on_sha` clause
calls `gh api repos/{repo}/commits/{sha}/status` and branches on `.state`. That **legacy
combined-status endpoint aggregates only old-style commit *statuses*** (contexts posted via the
Statuses API) and does **not** observe the *Checks* API (`/commits/{sha}/check-runs`), where all
modern GitHub-Actions build/test jobs live. On shader-slang repos the Status-API contexts are
essentially just `license/cla` + `CodeRabbit`, while the meaningful matrix is check-runs. So the
clause structurally cannot see an Actions build failure
([reads only the combined Status-API](../learnings/1788448775664-approver-clause-gap-ci-green-on-sha-reads-only-the.md),
[reads legacy commit-status, blind to check-runs](../learnings/1788479399455-approver-clause-gap-ci-green-on-sha-reads-legacy-c.md)).

This produces **three concrete false-signal modes**, all observed:

1. **False-PASS on red builds (the dangerous inverse).** On slang-rhi#851 the clause reported
   `ci_green_on_sha = pass` ("combined status=success") while all 6 Windows builds failed at the
   Build step and pre-commit (clang-format) failed. slang-rhi posts exactly 2 commit statuses
   (`license/cla`, `CodeRabbit`), both green, while `/check-runs` was full of `conclusion=failure`.
   With **0** posters the combined status is `pending` and the clause fail-safe-abstains; with
   **≥1 trivial poster going green** it FALSE-PASSES and masks red builds
   ([false-passes on slang-rhi](../learnings/1788374870675-approver-clause-gap-ci-green-on-sha-false-passes-o.md)).
   The same false-green risk was localized to a script defect on slangpy#1141, where 7 build
   jobs were still `in_progress` yet the clause passed — and would equally have passed if they'd
   been red ([false-green on slangpy build matrix](../learnings/1788518242912-approver-clause-gap-ci-green-on-sha-reads-legacy-c.md)).

2. **False-PASS / unevaluable on a red Actions matrix that never posts a status.** On slang-rhi#853
   the combined state was `pending` (only CodeRabbit + license/cla report) even though the Actions
   matrix had 10 hard `failure` check-runs (a real compile break — `OptixOpacityMicromap`
   undeclared under `-Werror`); once CodeRabbit settles to success the clause would report `pass`,
   blind to the red builds. On a repo whose CI is entirely Actions check-runs, the clause carries
   ~zero signal about the actual build
   ([reads only combined status; misses Actions failures](../learnings/1788448775664-approver-clause-gap-ci-green-on-sha-reads-only-the.md)).

3. **False-PASS on still-running builds.** On slangpy#1144 the clause recorded `pass` while all
   12 `build (...)` check-runs were `in_progress, conclusion=null` — the approver was woken with
   `APPROVER_CI_GATE` apparently OFF, mid-flight. "combined status=success" is not "CI is green"
   when the meaningful jobs are check-runs still executing
   ([blind to in-progress check-runs](../learnings/1788764743013-approver-clause-gap-ci-green-on-sha-reads-the-stat.md)).

**Directional safety and the backstop.** In shadow mode the clause only ever gates an *abstain*,
never a positive approve, so an over-lenient CI clause can at worst let a decision proceed to the
challenger — never auto-approve on red CI ([safe direction is abstain-only](../learnings/1788479399455-approver-clause-gap-ci-green-on-sha-reads-legacy-c.md)).
The production host `APPROVER_CI_GATE` parks reviewable PRs and only wakes the approver on a
settled head after required CI is green, normally covering the blind spot; the gap bites only with
the gate OFF ([APPROVER_CI_GATE backstop](../learnings/1788764743013-approver-clause-gap-ci-green-on-sha-reads-the-stat.md)).
Until the clause is hardened, the challenger is the only backstop: on any PR that would otherwise
pass the deterministic clauses (small enough for `tier_eligible`, trusted author, same-repo head),
never trust `ci_green_on_sha=pass` alone — read `/check-runs` directly and treat any check-run in
{failure, timed_out, cancelled, action_required} as CI-not-green ⇒ ABSTAIN, with PR-introduced-vs-
pre-existing attribution as a one-subagent check
([challenger must cross-check check-runs](../learnings/1788448775664-approver-clause-gap-ci-green-on-sha-reads-only-the.md),
[treat green as "no red legacy status," not "CI is green"](../learnings/1788479399455-approver-clause-gap-ci-green-on-sha-reads-legacy-c.md)).
Cheap red-build root-causing: after run completion, `gh run view --repo <r> --job <id>
--log-failed` serves the compile error (the `.../actions/jobs/<id>/logs` 302 redirect often
yields no Location via `gh api`); wait for `gh run view <run_id> --json status` to complete first
([root-cause a red build via --log-failed](../learnings/1788374870675-approver-clause-gap-ci-green-on-sha-false-passes-o.md)).
One recurring MSVC-only compile break to know: a `std::string_view` in a doctest `CHECK`/`REQUIRE`
instantiates `std::operator<<` and needs `<string>`/`<ostream>` — absent, it's MSVC C2027/C2065
while Linux/macOS pass
([string_view doctest MSVC break](../learnings/1788374870675-approver-clause-gap-ci-green-on-sha-false-passes-o.md)).

## Deterministic ABSTAIN clauses are by-design, not misses

Protected-path and size-cap clause FAILs route a PR to a human by design; abstains are excluded
from agreement scoring, so there is no false-safe when the approver makes no positive claim. Two
calibration confirmations reinforce that a subsequent clean merge at the reviewed commit is NOT
evidence the abstain was too conservative:

- **Protected-path abstain vindicated.** slang#12862 (a docs-only CI-skip PR touching only
  `.github/**` + `**/*.yml`) → ABSTAIN_POLICY (`CLAUSE_FAIL:no_protected_paths` + head_provenance).
  It merged at the reviewed commit on a MEMBER LGTM + author self-merge — *with* three 🟠 Major
  CodeRabbit CI-integrity findings (heredoc-delimiter injection, PR-controlled `./` composite-
  action checkout that can skip required build/test) left unaddressed. `.github/**`/`**/*.yml` are
  protected precisely because they are security-sensitive maintainer-judgment changes the read-only
  approver must not opine on; the CodeRabbit REQUEST_CHANGES verdict correctly never entered the
  decision. Do not let "it merged clean / a MEMBER approved / the fix looks obviously right" tempt
  a future WOULD_APPROVE on a `.github/**` PR
  ([protected-path abstain vindicated](../learnings/1788280113952-approver-calibration-protected-path-abstain-vindic.md)).

- **MEMBER-authored `.github/**` automation merges clean.** slang#12854 → ABSTAIN_POLICY
  (`CLAUSE_FAIL:no_protected_paths` + `tier_eligible` 686>400) under v0-shadow; merged unchanged
  by the MEMBER author at the exact decision commit. When (a) author_association ∈
  {MEMBER,OWNER,COLLABORATOR}, (b) same-repo head, (c) CI green, (d) changes confined to
  `.github/**` automation/config, expect an ABSTAIN purely from `no_protected_paths` (and often
  `tier_eligible` — these PRs are frequently large). Record it honestly; don't reason toward
  WOULD_APPROVE around a scripted clause fail, and don't re-escalate the policy mount per-PR. The
  accumulating merge-clean record is exactly the evidence a human would use to widen policy
  (per-trusted-author relaxation) — a human-gated decision; the approver's job is to keep feeding
  the calibration signal
  ([MEMBER .github PRs merge unchanged](../learnings/1788384987787-approver-calibration-member-authored-github-ci-prs.md)).

Class widening: this deterministic abstain is not limited to `.github/**` CI-only PRs. A large
**feature** PR that merely adds/edits a `CMakeLists.txt` (`**/CMakeLists.txt`) or exceeds the
400-line/30-file caps hits the same Step-1 early-return abstain — expect it on any big
standard-module/feature PR
([class widening: CMakeLists + size caps](../learnings/1788480227101-approver-stale-draft-build-caveats-all-ci-skipped-.md)).

## New CI lint-guard PRs: a safe, low-risk shape

A **new CI lint-guard PR** (e.g. slang#12793, a `git grep` guard rejecting `${CMAKE_BINARY_DIR}`)
merges safely when ALL of these hold — the checklist that carries the decision, not the diff size:
(1) the guard is provably **LIVE** — its failure direction is invisible to CI-green, so reproduce
it and run the **positive control** (it must exit non-zero on real violations, zero on a clean
tree; a guard you only saw pass on clean input carries zero bits); (2) current master is clean
under the guard so it won't red-fail every unrelated PR; (3) the guard is **wired into a real
gate** (a `pull_request` workflow with the right `paths:`), not a loose script — intentionally
non-required is fine when documented and matching a sibling precedent; (4) the scope boundary is
right (`git grep` over tracked files auto-excludes vendored submodules while covering first-party
`external/`; `-w` avoids embedded-identifier false positives). The one load-bearing caution: this
PR was dependency-ordered (held draft until a prereq merged, head moved), and the Devin signal was
initially STALE/draft-era — verifying **review-signal head-currency** was what made the
WOULD_APPROVE sound. Spend the challenger budget on (a) the positive control and (b) head-currency,
not on diff size. Outcome: MERGED unchanged at the exact decision commit — call confirmed correct
([confirmed-safe CI lint-guard PR](../learnings/1788162629504-approver-calibration-confirmed-safe-new-ci-lint-gu.md)).

## Stale draft caveats and all-SKIPPED CI on large feature PRs

Two more transferable lessons from slang#12859 (experimental numeric-interface modules,
+8672/-28, 40 files), independent of its ABSTAIN:

- **Draft-era build caveats go stale — re-verify on the pinned head.** The tasking and the
  as-opened (draft) body said the branch "won't build until #12136 lands," naming prerequisites;
  by the ready-for-review head, #12830 was MERGED and the branch rebased onto it, the current body
  *retracted* the hard-dependency claim, and two named "prerequisites" were tracking *issues*, not
  PRs (they don't resolve via `gh pr view`). For any stacked/prerequisite-flagged PR, check each
  prerequisite's current `state`/`mergedAt`, the PR's *current* body, and `baseRefName` on the
  pinned head — a draft caveat is not evidence about the ready head
  ([stale draft build caveats](../learnings/1788480227101-approver-stale-draft-build-caveats-all-ci-skipped-.md)).

- **All-SKIPPED CI gives ZERO executed-build signal.** Here `ci_green_on_sha` was
  `unevaluable (combined status=pending)`, and digging further the whole CI workflow run on the
  head had conclusion **skipped** — every build-*/test-* check-run `skipped`, and the production
  "Claude PR Review" workflow skipped too. Net: no compiler/test job actually ran on this head. When
  `ci_green_on_sha` is unevaluable/pending on a code PR, cross-check `gh run list --repo R --commit
  SHA` and `/check-runs`; all-`skipped` = the branch was never compiled by CI. Do NOT trust the
  author's "builds locally / N tests pass" (untrusted body text) as a build signal — flag the
  all-skipped CI to the human, since a large new-module PR merging with no executed build/test is
  material regardless of the clause outcome
  ([all-CI-SKIPPED gives no build signal](../learnings/1788480227101-approver-stale-draft-build-caveats-all-ci-skipped-.md)).

**Source learnings (9):**

- [Confirmed-safe: new CI lint-guard PR, positive-control verified, merged unchanged](../learnings/1788162629504-approver-calibration-confirmed-safe-new-ci-lint-gu.md) — the 4-point safe-guard checklist; spend challenger budget on positive control + review-signal head-currency.
- [Protected-path ABSTAIN vindicated — .github CI-gating PR merged with bot Major findings unaddressed](../learnings/1788280113952-approver-calibration-protected-path-abstain-vindic.md) — clean merge ≠ over-conservative; docs-only CI-skip is itself a CI-integrity attack surface.
- [ci_green_on_sha FALSE-PASSES on slang-rhi when a trivial status-poster is green while builds are red](../learnings/1788374870675-approver-clause-gap-ci-green-on-sha-false-passes-o.md) — combined status total=2 is meaningless; check-runs full of failure; string_view doctest MSVC break.
- [MEMBER-authored .github/** CI PRs over v0-shadow caps merge unchanged — abstain is deliberate scope](../learnings/1788384987787-approver-calibration-member-authored-github-ci-prs.md) — trusted-author + same-repo + CI-green + .github confined → expected deterministic abstain; feed calibration, don't widen.
- [ci_green_on_sha reads only the combined Status-API, not GitHub Actions check-runs](../learnings/1788448775664-approver-clause-gap-ci-green-on-sha-reads-only-the.md) — slang-rhi#853 10 failure check-runs while combined pending; challenger must read /check-runs.
- [ci_green_on_sha reads legacy commit-status API, blind to Actions check-runs](../learnings/1788479399455-approver-clause-gap-ci-green-on-sha-reads-legacy-c.md) — safe direction is abstain-only; treat green as "no red legacy status," not "CI is green."
- [Stale draft build caveats + all-CI-SKIPPED on large feature PRs (slang#12859)](../learnings/1788480227101-approver-stale-draft-build-caveats-all-ci-skipped-.md) — re-verify prereqs on pinned head; all-skipped = no executed build; class widening to CMakeLists + size caps.
- [ci_green_on_sha reads legacy combined-status, not the build check-runs — false-green risk (slangpy#1141)](../learnings/1788518242912-approver-clause-gap-ci-green-on-sha-reads-legacy-c.md) — clause passed with 7 build jobs in_progress; cross-check check-runs before letting green support WOULD_APPROVE.
- [ci_green_on_sha reads the Status API, blind to in-progress check-runs (slangpy#1144)](../learnings/1788764743013-approver-clause-gap-ci-green-on-sha-reads-the-stat.md) — passed while 12 build runs in_progress; APPROVER_CI_GATE normally covers it; treat non-completed check-runs as pending.
