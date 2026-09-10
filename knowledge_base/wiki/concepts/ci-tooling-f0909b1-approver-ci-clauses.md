---
title: PR-approver CI clauses and calibration — the ci_green_on_sha check-runs blind spot
type: concept
group: ci-tooling
tags: [pr-approver, ci-green-on-sha, check-runs, status-api, calibration, abstain, clause-gap]
source_count: 13
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

**The inverse false-signal: an external commit *status* makes the combined state RED while every check-run is green.** Because the combined-Status endpoint merges old-style commit *statuses* with (some) contexts, the same blindness cuts the other way — a red external `repository_dispatch` status can drive `ci_green_on_sha = fail` even when every build/test **check-run** passed or skipped. On slang#12975 R2 the clause reported `combined status=failure`, but `gh api commits/<sha>/check-runs` had 0 non-completed and 0 failing runs; the sole red was the external **"SlangPy Tests"** status (posted by slangpy's `ci-latest-slang.yml` after slang fires a `repository_dispatch`, `state=failure`, with no backing check-run). And that red is *expected in context*: #12975 exists **because** upstream #12840 retyped matrix layout `int`→`MatrixLayoutMode`, breaking SlangPy `main` against slang `master`, so "SlangPy Tests" is red on every slang PR until the coordinated SlangPy fix merges — the PR's whole purpose is to set `SLANGPY_CHERRY_PICK_PR` so that fix lands during the run. So when `ci_green_on_sha=fail`, split the combined status before calling it a diff regression: `gh api repos/<r>/commits/<sha>/statuses` (external: "SlangPy Tests", "CodeRabbit", "license/cla") vs `/check-runs` (real build/test); if the sole red is an external `repository_dispatch` status and all check-runs pass/skip, report it as a cross-repo coordination state, not a code defect — and on a clause-passing SlangPy-coordination / submodule-bump PR, `require_ci_green:true` + this external red drives a genuine ABSTAIN whose reason must be reported as "external coordinated check red," not "the diff broke CI" ([`ci_green_on_sha=fail` from an external "SlangPy Tests" `repository_dispatch` status, not a check-run — expected-red on coordination PRs](../learnings/1788945529133-approver-clause-gap-ci-green-on-sha-failure-from-t.md)).

**A further mode: structural unevaluability on check-runs-only repos.** Beyond the false-PASS modes above and the inverse false-red, the same Status-API blindness produces a *permanent* `CLAUSE_UNEVALUABLE:ci_green_on_sha` on any repo whose CI posts **only** Actions check-runs and no commit statuses. There the combined-status endpoint returns `{state:pending, total_count:0}` no matter how green the check-runs are (verified: 5–7 check-runs `completed/success`, combined `total_count` still 0), so the clause maps `pending`/none → unevaluable and infra-abstains. This became live-biting once policy **v0-shadow-wide-r2** set `require_ci_green:true` fleet-wide — the clause is now always consulted, so a fully-green check-runs-only PR (nanoclaw#1500 was the first hit, and is also the very PR that turns the requirement on) infra-abstains at Step 1 with every check-run green. Before trusting such an abstain, cross-check the two CI surfaces on the pinned head: `gh api repos/<r>/commits/<sha>/status --jq '{state,total_count}'` (what the clause sees) vs `gh api repos/<r>/commits/<sha>/check-runs` (the real Actions state, also in `gh pr view --json statusCheckRollup`); `status.total_count==0` while green check-runs exist means the abstain is an eval-clauses gap, not a CI problem. The operator fix is the same union proposed above — pass when combined-status is success OR (`total_count==0` AND all non-skipped check-runs conclude success), unevaluable only while a required run is in_progress/queued — and it is distinct from the earlier empty-policy-mount fallback class (that was a mount-source gap; this is a CI-signal-source gap in the clause itself) ([structurally unevaluable on check-runs-only repos when combined total_count=0](../learnings/1788949627703-approver-infra-abstain-ci-green-on-sha-unevaluable.md)).

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

**Faithful workflow-file language ports abstain on the protected-path clause too — but classify
them by failure direction.** A PR that only *ports* an existing CI step to another language
(slangpy#1145 replaced a `shell: bash` `run:` block with `actions/github-script@v8` in
`ci-latest-slang.yml` so self-hosted Windows runners with no `bash` on PATH can run it)
surface-resembles "a conditional CI change" that tempts an OPEN_GAP abstain for a missing positive
control — but a faithful port (`trim` → `.trim()`, digit-check → `/^[0-9]+$/`, `set -e` →
`exec.exec` rejecting on non-zero, empty → no-op) with an **unchanged `if:` gate** fails *loudly*
when triggered, never silently-wrong, so the "inject-the-hazard positive control" probe is N/A and
demanding it would false-abstain (a narrowing/port is not a new-flag+new-gate). Two by-design facts
that also defuse a CI-matrix "gap" here: the workflow has no `pull_request` trigger (schedule /
`workflow_dispatch` / `repository_dispatch` only), so the ported step is *never* exercised by the
PR's own CI ("never-triggered", not "pending"); and a bot "add macOS matrix" finding is outside-diff
+ pre-existing + by-design (macOS is covered by the nightly `build` job). Moot for the ledger
regardless: any `.github/workflows/**` edit resolves at Step 1 to
`ABSTAIN_POLICY:CLAUSE_FAIL:no_protected_paths` (early return, no challenger/critique) — the policy
routing the *semantic* review of workflow YAML to a human — and the subsequent clean human merge is
the expected APPROVED-equivalent join, not a miss
([faithful bash→github-script CI-step port is loud-failure-direction; workflow-file PRs policy-abstain](../learnings/1788969888394-approver-confirmed-faithful-bash-github-script-ci-.md)).

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

**A CI-matrix entry is NOT automatically that positive control — confirm the consuming workflow
fired on THIS head.** When a PR adds a new build-config flag + gate and an entry in
`.github/cmake-options-matrix.json` (e.g. `SLANG_ENABLE_TSAN`, slang#12709), it is tempting to treat
the matrix entry as the trigger-present positive control (probe #4 of the gate/flag standing probe)
and WOULD_APPROVE on all-green CI. But `cmake-options-matrix.json` is consumed *only* by
`cmake-options.yml`, which triggers on `workflow_dispatch` + a weekly Saturday `schedule` (cron
`0 8 * * 6`) — the `merge_group` trigger was removed (10-job matrix ate half the runner budget) and
it **never ran on `pull_request`** — so adding a matrix entry runs no build with the new flag ON on
the PR head or on merge, and the green PR CI carries **zero bits** about whether the flag produces a
working build. Rule: when a positive control depends on a CI matrix, verify the CONSUMING workflow's
`on:` triggers actually fired for THIS head (`gh api repos/<r>/actions/runs?head_sha=<sha>` — absent
from the list ⇒ the control did not run), and name-match lanes before crediting them (a green
`sanitizer-linux-clang-x86_64` lane is the EXISTING ASan build from `ci-slang-sanitizer.yml`, not a
TSan build). Distinguish the gate being **LIVE** (enabling the flag emits the flag — verify by
inspection, e.g. `-fsanitize=thread` in `set_default_compile_options`) from the flag producing a
**WORKING build** (needs a trigger-present control that actually ran); a faithful mirror of a
CI-proven sibling branch de-risks but does not substitute for the control. Build-config flags fail
LOUD (link error) and default-off, so an unproven-build gap is OPEN_GAP (policy), not BLOCK — hand
to a human to confirm the build or accept a documented CI deferral ⇒ ABSTAIN_POLICY:OPEN_GAP
([cmake-options-matrix.json entries are not a positive control on a PR head — verify the consuming workflow's triggers fired](../learnings/1788979868955-approver-challenger-miss-slang-cmake-options-matri.md)).

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

**Source learnings (13):**

- [Confirmed-safe: new CI lint-guard PR, positive-control verified, merged unchanged](../learnings/1788162629504-approver-calibration-confirmed-safe-new-ci-lint-gu.md) — the 4-point safe-guard checklist; spend challenger budget on positive control + review-signal head-currency.
- [Protected-path ABSTAIN vindicated — .github CI-gating PR merged with bot Major findings unaddressed](../learnings/1788280113952-approver-calibration-protected-path-abstain-vindic.md) — clean merge ≠ over-conservative; docs-only CI-skip is itself a CI-integrity attack surface.
- [ci_green_on_sha FALSE-PASSES on slang-rhi when a trivial status-poster is green while builds are red](../learnings/1788374870675-approver-clause-gap-ci-green-on-sha-false-passes-o.md) — combined status total=2 is meaningless; check-runs full of failure; string_view doctest MSVC break.
- [MEMBER-authored .github/** CI PRs over v0-shadow caps merge unchanged — abstain is deliberate scope](../learnings/1788384987787-approver-calibration-member-authored-github-ci-prs.md) — trusted-author + same-repo + CI-green + .github confined → expected deterministic abstain; feed calibration, don't widen.
- [ci_green_on_sha reads only the combined Status-API, not GitHub Actions check-runs](../learnings/1788448775664-approver-clause-gap-ci-green-on-sha-reads-only-the.md) — slang-rhi#853 10 failure check-runs while combined pending; challenger must read /check-runs.
- [ci_green_on_sha reads legacy commit-status API, blind to Actions check-runs](../learnings/1788479399455-approver-clause-gap-ci-green-on-sha-reads-legacy-c.md) — safe direction is abstain-only; treat green as "no red legacy status," not "CI is green."
- [Stale draft build caveats + all-CI-SKIPPED on large feature PRs (slang#12859)](../learnings/1788480227101-approver-stale-draft-build-caveats-all-ci-skipped-.md) — re-verify prereqs on pinned head; all-skipped = no executed build; class widening to CMakeLists + size caps.
- [ci_green_on_sha reads legacy combined-status, not the build check-runs — false-green risk (slangpy#1141)](../learnings/1788518242912-approver-clause-gap-ci-green-on-sha-reads-legacy-c.md) — clause passed with 7 build jobs in_progress; cross-check check-runs before letting green support WOULD_APPROVE.
- [ci_green_on_sha reads the Status API, blind to in-progress check-runs (slangpy#1144)](../learnings/1788764743013-approver-clause-gap-ci-green-on-sha-reads-the-stat.md) — passed while 12 build runs in_progress; APPROVER_CI_GATE normally covers it; treat non-completed check-runs as pending.
- [ci_green_on_sha=fail from an external "SlangPy Tests" repository_dispatch status, not a check-run — expected-red on SlangPy-coordination PRs (slang#12975)](../learnings/1788945529133-approver-clause-gap-ci-green-on-sha-failure-from-t.md) — the inverse of the false-green: split combined `/statuses` vs `/check-runs`; an external red + all-green check-runs is a cross-repo coordination state, reported as "external coordinated check red," not a diff regression.
- [`CLAUSE_UNEVALUABLE:ci_green_on_sha` structurally unevaluable on check-runs-only repos — combined-status total_count=0 (nanoclaw#1500)](../learnings/1788949627703-approver-infra-abstain-ci-green-on-sha-unevaluable.md) — combined-status returns `total_count=0` regardless of green check-runs, so with `require_ci_green:true` fleet-wide the clause permanently infra-abstains on green PRs; cross-check `/check-runs`, fix by unioning check-runs into the clause.
- [Faithful bash→github-script CI-step port is loud-failure-direction; workflow-file PRs policy-abstain (slangpy#1145)](../learnings/1788969888394-approver-confirmed-faithful-bash-github-script-ci-.md) — classify a faithful port by failure direction (unchanged `if:` gate + `exec.exec` rejects on non-zero ⇒ loud, not silently-wrong), so demanding an inject-the-hazard positive control false-abstains; `.github/workflows/**` abstains on `no_protected_paths` regardless.
- [cmake-options-matrix.json entries are NOT a positive control on a PR head (slang#12709)](../learnings/1788979868955-approver-challenger-miss-slang-cmake-options-matri.md) — `cmake-options.yml` runs only on `workflow_dispatch`/weekly `schedule`, never `pull_request`, so a matrix entry builds nothing on the head; verify the consuming workflow's triggers fired via `actions/runs?head_sha=`, name-match lanes, and separate gate-LIVE from build-WORKS ⇒ ABSTAIN_POLICY:OPEN_GAP.
