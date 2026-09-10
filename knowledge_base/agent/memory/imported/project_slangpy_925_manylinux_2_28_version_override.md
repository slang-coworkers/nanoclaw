---
name: project_slangpy_925_manylinux_2_28_version_override
description: "slangpy#925 manylinux_2_28 wheels — approver ABSTAIN_POLICY was SPURIOUS (per-PR staged policy shadowed the signed mount and fell back to the stricter bundled default); the real 🟠 regression (Linux wheels lose SLANGPY_VERSION_OVERRIDE) is CONFIRMED by executing cibuildwheel's own resolver; abstain stands on substance."
metadata:
  node_type: memory
  type: project
  originSessionId: webhook-slangpy-925-2026-08-05
---

# slangpy#925 — "Support manylinux_2_28 wheels" (jkiviluoto-nv)

Head `4743d90ff367` · branch `manylinux-2-28` → `main` · `Fixes #924` · **2 files, +13/-5**
(`.github/workflows/wheels.yml`, `external/CMakeLists.txt`). Auto-merge (squash) ARMED by
`ccummingsNV` 12:55:44Z; only `BEHIND` holds it. `slang#10777` dep discharged (merged 04-13; the
pinned `SGL_SLANG_VERSION "2026.12"` ships both linux glibc-2.28 tarballs). Canonical thread
`gh-issue-shader-slang/slangpy-925`.

## The real regression — CONFIRMED by executing the tool, not reasoning about precedence

Linux wheels lose `SLANGPY_VERSION_OVERRIDE`. The PR added workflow-level `CIBW_ENVIRONMENT_LINUX`
(`wheels.yml:25`); the step-level `CIBW_ENVIRONMENT` at `:133` sets `SLANGPY_VERSION_OVERRIDE` but
never sets `CIBW_ENVIRONMENT_LINUX`, so the new workflow-level Linux value survives into the step and
**replaces** (not merges) the override on Linux only. Verified by `pip install cibuildwheel==3.4.1` and
calling `OptionsReader.get('environment', …)`: post-PR Linux resolves without the override; windows/macos
keep it. Controls confirmed REPLACE semantics and a live resolver. Source agrees (`options.py:741` reads
`environment` with no `env_rule` ⇒ `InheritRule.NONE` ⇒ `after` unconditionally); no rescue path
(`CIBW_ENVIRONMENT_PASS`, `[tool.cibuildwheel]`). **Blast radius:** nightly dev wheels — Linux carries
the `sgl.h` version while windows/macos carry the dev version, published that way. **One-line fix:** add
`SLANGPY_VERSION_OVERRIDE=…` to `:25`, or set `CIBW_ENVIRONMENT_LINUX` at `:133`.

**Onset = the merge, not either conjunct.** Merge `e5f2299b2b63` (06-23) co-located A's `_LINUX` line
and B's step-level override; neither parent carries the defect. Three candidate birthdays (04-09 conjunct
· 06-23 merge condition · 08-05 observation) — only the merge is right; the `cibuildwheel 3.0.0rc1→3.4.1`
bump at head changes *severity, not the birthday* (don't let a report's chosen mechanism reset the clock).
The review approval (07-29) **postdates the 06-23 collision by ~5 weeks** — see
[[feedback_a_reviews_commit_id_can_postdate_the_review]].

**The defect came from HUMAN RESOLUTION of a conflict git correctly raised** — replayed with
`git merge-tree`, `wheels.yml` conflicted and was hand-resolved, keeping A's `_LINUX` and taking B's
global+step-level override. Filing it as "invisible to conflict markers" would point future probes at a
silent-merge detector and miss it. Right probe has **two clauses: (1) was this file hand-resolved during a
merge, AND (2) did the conflict region contain ALL conjuncts of the hazard?** — the step-level override
auto-merged 108 lines below the hunk, so reviewing only the resolution hunk *also* misses it; read the
whole post-resolution file. **Tooling:** use `git merge-tree --write-tree --name-only` — the 3-arg
`git merge-tree base A B` exits 0 on both conflict and clean, so its exit code and its `changed in both`
string cannot discriminate.

## The abstain was SPURIOUS — staged-policy shadowing (the durable pipeline finding)

`slangpy-pr-approver` recorded **ABSTAIN_POLICY · `CLAUSE_FAIL:no_protected_paths`** @ `4743d90ff367`,
mode `live_late`, `policy_version: v0-shadow`. Resolution order (`eval-clauses.py:267-283`):
`--policy PATH` → **per-PR staged `<workspace>/policy/APPROVAL_POLICY.json` (WINS)** → group mount
`/workspace/extra/approver-policy/…` (the SIGNED file) → bundled default. #925's workspace had a staged
snapshot pinned to `v0-shadow` (8 protected patterns incl. `.github/**`, `**/*.yml`) which **shadowed**
the mounted human-signed `v0-shadow-wide` (1 pattern, caps 8000/150).

**Root cause narrowed — staging FELL BACK, pinning is not wrong:** all 4 stale snapshots are byte-identical
(`cmp`) to the skill-bundled `scripts/APPROVAL_POLICY.json` (the bundled default = `v0-shadow`), while the
17 era-correct ones differ (negative control). The staging step fell through to precedence 4 and wrote the
bundled default into `policy/`, where precedence 2 then loaded it over the mount. **FIX: staging must never
fall back to bundled when a mount exists; record the loaded policy's absolute path in `clauses.json`** — the
field that turns this from eight-round archaeology into a one-line read, and whose *first catch was the
mismatch itself* (naming the policy is what exposed it; "re-derived correctly" carries no tripwire).

⛔ **The workspace where it happened is booby-trapped:** all 4 still carry their stale
`policy/APPROVAL_POLICY.json`, so a naive `eval-clauses.py` re-run *in place* takes precedence 2 and
reproduces the defect. Never re-derive in place — clear the pin or pass `--policy`; pre-flight with
`cmp <ws>/policy/APPROVAL_POLICY.json <bundle>` (the same test that narrowed the root cause, used as a guard).

**CLAUSE-ELIGIBLE ≠ APPROVABLE.** Passing Step-1 clauses only means Step-2 *runs*. With the signed policy
loaded #925 lands on **ABSTAIN_POLICY:OPEN_GAP** on the substance (Step-2 input was `REQUEST_CHANGES`, 2
gaps — both MINE-VERIFIED: the shadowing above, and a missing trigger-present control on a
`workflow_dispatch:`-only wheel path). ⇒ **CORRECT: the abstain was recorded for the WRONG REASON, not for
no reason — same verdict, sound derivation.** "Would have been WOULD_APPROVE" is dangerous phrasing (invites
"the approver would approve a PR with a known regression" — the opposite of true): ⭐⭐⭐ **an eligibility fix
changes the REASON, never the VERDICT; never report a gate correction as an outcome change without reading
the downstream stage.** See [[feedback_the_more_sayable_version_wins_before_verification_runs]].

## Era-relative auditing, and the false-negative join

⭐⭐⭐ **A version-drift sweep MUST be era-relative.** The absolute form produced **21 alarms where 4 were
real** (5× false-positive rate on a finding already sent upstream) — 17 of 21 snapshots pinned the policy
actually in force at *their own* timestamp, which is *correct* auditability. Dating correctness from NOW
rather than from when the condition obtained is the two-birthdays error on an inventory. Era boundaries:
`v0-shadow` → `v0-shadow-relaxed` (07-10) → `v0-shadow-wide` (08-04). A later question cannot retroactively
validate an earlier over-call.

**The join (ABSTAIN-vs-merged): 8 of 28 recorded abstains were false-negatives (29% per-decision — quote
the denominator: 28 rows span ~10 PRs).** All 8 are one change class — onboarding a repo to slang's reusable
`pr-board-sync.yml`; humans approved+merged every one ⇒ **outcome-derived support for `v0-shadow-wide`.**
⭐⭐⭐ **Two distinct causes produce the SAME recorded abstain and need different instruments:** wrong policy
loaded (#918 — found by version/era audit) vs correct policy + over-strict clause (#1002 — findable *only*
by an outcome join, structurally invisible to every version-audit instrument). ⇒ build the outcome detector
even when you believe the set is closed. Direction of the whole defect is **CONSERVATIVE** (spurious
abstains, no wrongly-permissive merge) — which is why nothing alerted; the cost is destroyed calibration
signal, not a bad merge.

## `require_ci_green: false` is AUTHORIZED — do not re-tighten

⭐⭐⭐ **A signed tradeoff and a bug look identical in the JSON.** The mounted `v0-shadow-wide` carries a
deliberate human-signed widening (`_comment`: haaggarwal 2026-08-04; 232 decisions, 53% ABSTAIN_POLICY, 91%
of decisive abstains later approved; `no_protected_paths` fired exclusively on `.github/**`, 32 cases).
Reporting "the clause was waived" bare invites reverting a signed setting and buying back the 53% abstain
rate. The three-outcome clause split (`pass`/`unevaluable`/`not_applicable`) was **withdrawn** — a
`not_applicable` status falls through every summary bucket in `eval-clauses.py` (FAIL→ABSTAIN_POLICY,
UNEVALUABLE→ABSTAIN_INFRA, all-PASS→continue) and reads as satisfied, a *silent* false-safe. ⭐⭐⭐ **A status
value is an INTERFACE, not a description — check what the CONSUMER does with it.**

## CI-trust: three independent false-safe axes

A `ci_green_on_sha` on this PR is green and says nothing about the change, three ways:

- **Wrong instrument.** `gh api commits/$SHA/status` returns only legacy commit-status contexts
  (`license/cla`, `CodeRabbit`) — it *structurally cannot see* Actions check-runs where every `build (…)`
  leg lives. Fleet worst case is **slang: 2 contexts (one a CLA bot) speak for 278 check-runs**. The
  zero-poster case is fail-*safe* (`state: pending`); the danger is *exactly the wrong posters*.
- **Timing.** The clause read `success` 34 min before the build suite completed (build-blind at decision time).
- **Coverage.** `wheels.yml` is `on: workflow_dispatch:` only and is `paths-ignore`d by `ci.yml`, so **0
  wheel legs run in PR CI**, and the PR's new `SGL_SLANG_GLIBC_COMPAT=ON` path (only setter: `wheels.yml:25`)
  is dead under all PR CI (condition-true 0×). ⇒ ⭐⭐⭐ **coverage is a third axis independent of timing and
  instrument: a flag whose only setter is outside CI's reach** — a required-suite gate would still release
  onto a green that proves nothing about this diff. Related: [[project_slangpy_1066_ci_pathsignore_stuck_checks]].

**Gate config (measured behaviourally — no readable live `.env`):** `APPROVER_CI_GATE` defaults OFF.
`CI_GATE_REQUIRED_SUITE` matches on the **App slug** (`github-webhook-server.ts:524`), and all slangpy
suites share `github-actions`, so it releases exactly as unset. The working lever is
`CI_GATE_REQUIRED_CHECK_RUN` (`owner/repo=check-name`, unlisted repos fall back). **Recommended:
`APPROVER_CI_GATE=on` + `CI_GATE_REQUIRED_CHECK_RUN=shader-slang/slang=check-ci`; slangpy has NO roll-up
check** (12 individual `build (…)` legs) — it needs a `needs:[build]` + `if: always()` roll-up before it can
be gated precisely. ⛔ **The park has no TTL/expiry/list** (`pending-reviewable/store.ts` exports only
park/find/delete) — any missed release is a permanent invisible wedge whose only exit is hand-deleting a DB
row; gate arming should also add a park TTL + observability so a miss degrades to a *late wake*.

## The JOIN generalization (held at four altitudes)

⭐⭐⭐ **A check that sees only one side of a join cannot see a join defect** — and a caller-only view can
*manufacture* a concern as readily as a per-file view misses one (a Devin flag to set `permissions: {}`
would have made the repo *less* safe; the resolution lived in the callee's reusable workflow one repo over).
Held at four altitudes this chain: 17 green CI legs covering none of the diff · a merge of two
individually-clean parents · a conflict hunk showing one conjunct while the other auto-merged 108 lines away
· a test harness varying one side while the real case varied another. ⇒ **for a delegating or multi-file PR,
ask which side of the join the diff does NOT show you, then read that side before assigning severity.** The
`shader-slang/slang` default branch is `master` while `slangpy` is `main` — two siblings, different
defaults; `?ref=main` fails silently on one.

**Method lessons this investigation reinforced (filed elsewhere):**

- A negative control must differ from the positive in **exactly one variable** and never be a strictly
  easier instance (a clean-merge control using two *different* files read `1 vs 1` and would have called
  CONFLICT on every same-file merge). See [[feedback_a_negative_control_must_vary_exactly_one_thing]].
- No copy on my disk settles what the host *process* loaded; a citation needs its **path** verified, not
  just its lines (`file:line` is not unique across parallel `sgl/` + `slangpy_ext/` trees). See
  [[feedback_every_copy_on_my_disk_never_settles_what_a_run_did]].
- An unnecessary retraction is a real error, not humility; retreat feels safe so it is audited less. Run the
  program's own predicate, not a stdlib lookalike. See [[project_approver_pipeline_defects_devin_fetch_ci_green]],
  [[feedback_run_the_programs_own_predicate_not_a_stdlib_lookalike]],
  [[feedback_a_positive_control_cannot_detect_an_incomplete_enumeration]].

## RESUME

RESUME = `ccummingsNV`/`jkiviluoto-nv` either (a) pushes the one-line `SLANGPY_VERSION_OVERRIDE` fix to
`:25`, (b) disarms auto-merge, or (c) the PR goes un-`BEHIND` and auto-merges with the defect (then the
follow-up is a fix PR against main). Nothing owed from a coworker: approver decided, recorded, read-only,
correctly did not post. A comment must precede any `Update branch` click (the clearing act is a deliberate
human merge, so auto-merge fires immediately with no window).
