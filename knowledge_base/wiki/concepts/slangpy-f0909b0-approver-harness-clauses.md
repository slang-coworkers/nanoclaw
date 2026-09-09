---
title: SlangPy PR-approver — clause mechanics, review-signal harvesting, and harness blind spots
type: concept
group: slangpy
tags: [slangpy, approver, clauses, coderabbit, devin, ci-status, submodule, epistemic-discipline]
source_count: 13
---

## TL;DR

The slangpy PR-approver runs a deterministic pipeline: Step-1 metadata clauses
(author_trust, head_provenance, commit_match, ci_green_on_sha, tier_eligible,
no_protected_paths) → Step-2 verdict parse of a harvested bot review → Step-3
severity judgement + adversarial challenger. Any Step-1 clause FAIL
short-circuits before the challenger ever runs, so an abstain on size or protected
paths is a routing decision, not a code concern.

Key harness facts to hold:

- **Run `eval-clauses.py` as a FAST PRE-GATE right after staging context**, before
  the ~6-min CodeRabbit poll and the Devin subagent. `external/**` bumps and
  oversize diffs deterministically FAIL Step-1; harvesting review signal for them
  is wasted work.
- **`external/slang-rhi` (and any `external/**`) trips `no_protected_paths`** — by
  design, because the substantive change lives in a submodule the approver cannot
  diff. Abstain; do not reclassify as infra or widen policy.
- **`ci_green_on_sha` reads the COMBINED COMMIT STATUS API, not check-runs.** A red
  cross-repo "SlangPy Tests" status fails it while every check-run is green. Check
  BOTH `/commits/<sha>/status` and `/commits/<sha>/check-runs`.
- **The mounted policy can change between revisions of the same PR** (`v0-shadow-wide`
  vs stricter `v0-shadow`). Read the `policy_version` each time.
- **slangpy's bot reviewer is CodeRabbit, posted as an ISSUE COMMENT** — harvest exit
  20 is not "no review"; read `coderabbitai[bot]` issue comments and confirm the
  head SHA.
- **CodeRabbit latency scales with diff size**; on >1000-line PRs it can time out the
  poll window → degraded Devin-only signal. **Devin frequently times out (~20m, exit
  3)** and is never decision-critical alone.
- **Step-1 FAIL is a POLICY reason (`CLAUSE_FAIL:<name>`), never `NO_REVIEW_SIGNAL`.**
  Misfiling dings the infra gate for a PR the policy correctly routed to a human.
- **Verify every claim at its source**: "PR-triggered", "advisory nit", and any
  hand-computed aggregate are claims to verify, not assert. The DECISION_REVIEW
  critique gate exists to catch approve-leaning drift.

## The pipeline and its short-circuit

The approver grades a PR through ordered steps, and the ordering itself is
load-bearing. Step-1 clauses are cheap metadata predicates over `gh` PR metadata,
the changed-path list, and the mounted policy; Step-2 parses a harvested bot
review's verdict; Step-3 applies severity judgement plus an adversarial challenger.
A Step-1 clause FAIL short-circuits before Step-3, so **the challenger never runs on
a size- or protected-path-failing PR** [size-cap short-circuit](../learnings/1786479318515-approver-clause-gap-size-cap-short-circuit-defers-.md).

The most expensive mistake is running the pipeline out of order. On slangpy#1140
("opacity micromap support", +1326 lines, `external/slang-rhi` bump) the workflow
harvested CodeRabbit (exit 22, pending), polled ~5.5 min, and dispatched a Devin
subagent (~7 min) — all before `eval-clauses.py` FAILed instantly on
`no_protected_paths` AND `tier_eligible`. The review signal was moot, because a
Step-1 FAIL is never overridden by a Step-2 verdict. The fix is a procedure tweak:
**run `eval-clauses.py` as a fast pre-gate right after staging `tmp/context.json`**,
and when Step-1 already yields a hard FAIL, synthesize a short honest review-doc
noting the signal was moot and skip the poll+Devin entirely
[run eval-clauses first](../learnings/1788504229444-approver-process-slangpy-external-slang-rhi-bump-o.md).
A related sequencing note: run `eval-clauses.py` AFTER synthesizing
`review/review-doc.md`, not before, or `commit_match` evaluates `unevaluable` and
records a spurious `CLAUSE_UNEVALUABLE` infra dinger on top of the real policy fail
[ci_green_on_sha combined status](../learnings/1788303100252-approver-clause-gap-ci-green-on-sha-reads-the-comb.md).

## The `external/**` protected-path guard is the submodule blind spot

slangpy vendors slang-rhi as `external/slang-rhi`, and `skallweitNV` bumps it
frequently. Three distinct failure surfaces converge on this one path:

1. **`no_protected_paths` FAILs deterministically.** On slangpy#1126 ("compile
   report cache keys") every other clause was green and the review was clean, but
   the PR's stated primary mechanism lived entirely in the gitlink bump
   (20cae56b→22239042). The guard firing is correct: it recognizes "the substantive
   change is invisible from `gh pr diff` — a human must look." This is a POLICY
   abstain, not infra; do NOT reclassify, widen policy, or treat green sibling
   clauses as grounds to round up
   [external/slang-rhi abstains on no_protected_paths](../learnings/1787903720357-approver-clause-gap-slangpy-external-slang-rhi-sub.md).

2. **The review harness is structurally blind to submodule-pointer diffs.** On
   slangpy#1103 (a 1-line `external/slang-rhi` bump) CodeRabbit path-excludes
   `external/**` (posts "Review skipped due to path filters" + a green *status* that
   is NOT a review), production `github-actions[bot]` is absent, and Devin only sees
   the pointer line. `reviewers_complete=false` → NO_REVIEW_SIGNAL. The signals that
   actually discriminate for a bump — the submodule commit-range compare, whether
   any public `include/` header changed, and the consumer's own real-GPU CI on the
   pinned head — cannot round an abstain up to WOULD_APPROVE (self-review is
   forbidden), but they belong in the ledger for the human
   [submodule-bump blind spot](../learnings/1786485504819-approver-infra-abstain-slangpy-1103-submodule-bump.md).

3. **Size caps are driven by the visible slangpy churn, not the submodule.** In the
   `base...head` compare, `external/slang-rhi` shows as only +1/-1, so `tier_eligible`
   fails on the authored diff around it
   [run eval-clauses first](../learnings/1788504229444-approver-process-slangpy-external-slang-rhi-bump-o.md).

## `ci_green_on_sha` reads combined status, and policy is not stable across revisions

Two gotchas that flipped slang#12595 from WOULD_APPROVE to ABSTAIN across revisions
both transfer to slangpy. First, `ci_green_on_sha` reads the **combined commit
status** (`gh api /commits/<sha>/status` → `.state`), which aggregates commit
statuses — CLA bots, CodeRabbit's status, and cross-repo statuses like "SlangPy
Tests" — a different GitHub surface from check-runs. At R3 all 69 slang check-runs
were green but the combined status was `failure` because the cross-repo "SlangPy
Tests" status was RED. To judge green, check BOTH endpoints and report the failing
context + its `target_url`. Second, the mounted `APPROVAL_POLICY` can change between
revisions of the same PR: R1/R2 ran under `v0-shadow-wide` (fork head allowed, CI not
required), R3 under the stricter bundled `v0-shadow` default. Same PR, same fork,
different outcome — driven by policy version, not code
[ci_green_on_sha combined status](../learnings/1788303100252-approver-clause-gap-ci-green-on-sha-reads-the-comb.md).

A now-shipped hazard sharpens this: slang#12939 merged a `mark-slangpy-tests-skipped`
job that auto-posts `SlangPy Tests = success ("Skipped for docs-only change")` on
docs-only PRs. That green is the exact combined-status context `ci_green_on_sha`
trusts — so on a docs-only PR a green `SlangPy Tests` no longer means the SlangPy
suite ran; it can mean a skip-job synthesized success. Legitimate for docs-only, but
the challenger must not read it as substantive test coverage, and a source-changing
PR misclassified as docs-only by `.github/actions/docs-only-filter` would get a
synthetic pass
[docs-only self-satisfy SlangPy Tests](../learnings/1788881023117-approver-clause-gap-docs-only-slang-prs-now-self-s.md).

## CodeRabbit and Devin: where the review signal comes from, and where it fails

slangpy has **no `github-actions[bot]` claude-code-action pipeline** (unlike
shader-slang/slang); its bot reviewer is CodeRabbit, and CodeRabbit posts its verdict
as an **issue comment** (`issues/<n>/comments`, author `coderabbitai[bot]`, carrying
the `<!-- summarize by coderabbit.ai -->` walkthrough + "Actionable comments posted:
N" + a `Merge Risk:` line), NOT a formal PR review in `pulls/<n>/reviews`.
`harvest-reviews.py`/`collect-reviews.sh` key on the reviews endpoint, so
CodeRabbit's signal is invisible → exit 20. On slangpy#1111 taking exit 20 at face
value would have discarded the only bot signal. The catch: on exit 20/22, read the
issue comments for `coderabbitai[bot]`, confirm it reviewed the *pinned head* (the
"between <base> and <head>" line names exact SHAs), and if so treat it as a valid
fallback-tier review (no actionable + Minimal risk → APPROVE)
[CodeRabbit posts as issue comments](../learnings/1786969098327-approver-clause-gap-slangpy-coderabbit-posts-revie.md).

CodeRabbit's latency scales with diff size. On slangpy#1142 (1283-line new-API PR),
`pending_bot=CodeRabbit` persisted across all 12 polls of the ~6-min window without
posting — the review was likely imminent but slower than the poll budget, silently
degrading the signal to Devin-only. The signature is `pending_bot=CodeRabbit` all the
way to timeout on a large PR; state it prominently and consider scaling the poll
window past 6 min when changed-lines exceed ~800
[CodeRabbit latency timeout](../learnings/1788527120708-approver-infra-abstain-coderabbit-review-latency-t.md).

Devin is a best-effort *secondary* head-current signal, never decision-critical
alone. It runs via `agent-browser` against app.devin.ai and frequently fails to
reach a stable done state within 20 min (exit 3), even for tiny diffs — on
slangpy#1111 a 13-line CMake PR timed out after ~21 min. A Devin timeout is only
`NO_REVIEW_SIGNAL` when there is ALSO no harvested bot review; when CodeRabbit's
head-current review carries `reviewers_complete=true`, note the Devin skip and decide
from the bot review. Run Devin in a fresh subagent so its 20m/64k-token churn never
enters the decision session's context, and don't re-run it hoping it settles
[Devin fetch timeouts](../learnings/1786969110628-approver-infra-abstain-devin-fetch-on-slangpy-prs-.md).

The classification rule ties this together: when the bot review never settles AND you
abstain, the operative reason is the POLICY reason `CLAUSE_FAIL:<name>` if a Step-1
clause failed — NOT `NO_REVIEW_SIGNAL`. `NO_REVIEW_SIGNAL` is an INFRA reason
(excluded from agreement scoring, drives the infra gate toward zero) reserved for
when Steps 1–2 would otherwise pass but there is genuinely no bot review and no Devin
signal. Step-1 FAIL takes precedence in the procedure ordering
[run eval-clauses first](../learnings/1788504229444-approver-process-slangpy-external-slang-rhi-bump-o.md).

## Verify every claim at its source — the DECISION_REVIEW gate earns its cost

A recurring, one-directional-toward-approve drift is asserting a fact instead of
reading it. On slangpy#1119 ("thread sanitizer") the WOULD_APPROVE draft made two
errors the codex DECISION_REVIEW gate caught. (1) It claimed "PR-triggered positive
control satisfied" — but `sanitizers.yml`'s `on:` block is `schedule` +
`workflow_dispatch` only (no `pull_request`), and the green run was a manual
dispatch. **A green CI lane proves the flag FIRES at that head; it says nothing about
whether PRs auto-exercise it** — two separate facts, each with its own source (the
workflow `on:` block AND `gh api .../actions/runs/<id> --jq .event`). (2) It
downgraded CodeRabbit's one actionable finding (verbatim "required before merge or
need explicit security-owner acceptance") to an "advisory nit" by appeal to
convention. When a review source labels a finding blocking, **that IS the parsed
verdict (REQUEST_CHANGES); parse it, don't reinterpret it** — save the low-risk
argument for Step-3 severity, where uncertainty abstains
[PR-triggered/advisory-nit are claims to verify](../learnings/1787210533975-approver-critique-mustfix-pr-triggered-and-advisor.md).

That PR also names a transferable OPEN_GAP class: a CI/build-infra PR that
**downloads an external toolchain and then builds/runs with it** (here `curl | tar`
of an LLVM 22 archive into PATH) carries a supply-chain gap when all of — no
integrity check (TLS + `--fail` proves transport, not the intended bytes), runs on a
credentialed runner and/or uses an unpinned action, and no security-owner has
accepted the surface. A bot flagging exactly this as "required before merge" is a
merge-gating verdict → REQUEST_CHANGES → OPEN_GAP. "A green lane ran the download"
proves usability at that head, not archive integrity; "matches repo convention" is
valid only for genuinely-unchanged items, never a NEW download. The Step-0 recall
hook: when changed paths include a new/edited `.github/workflows/*` that fetches an
external binary, grep for `curl`/`wget`/`Invoke-WebRequest` + `tar`/`unzip` and check
for a companion checksum verification
[CI sanitizer unverified toolchain OPEN_GAP](../learnings/1787210571422-approver-calibration-ci-sanitizer-infra-pr-that-do.md).
(Note: the calibration of whether that gap *should* have abstained given the confined
blast radius is revisited in the calibration page — the merge outcome argued it was an
over-abstain.)

The same "verify at source" discipline governs numbers. A CORRECTION on slangpy#1050
found the published vendored share (7644 lines/60%) was wrong twice from one root: a
plain arithmetic slip (the six listed paths actually sum to 8717) and an incomplete
enumeration (omitting `external/CMakeLists.txt`; the true total is 8726/69% across
seven paths). The root cause was **an enumeration presented as a measurement** — the
aggregate was summed by eye and reported in the same confident register as the
tool-produced figures beside it. The cheap invariant: any aggregate in a report gets
computed by the tool that has the data, and parts must sum to the whole
[slangpy#1050 vendored-share correction](../learnings/1786385423604-approver-clause-gap-correction-the-slangpy-1050-ve.md).
Its addendum records the authoritative per-revision figures (R1 8726/3926/12652, R2
8726/3936/12662, both reconciling) and a subtler reasoning trap: **a reconciliation
identifies a referent, it does not locate a mistake.** A reviewer's observation that
`8726 + 3926 = 12652 = R1's total` correctly said *which revision the 3926 describes*,
but "therefore it's in the wrong sentence" skips reading what the sentence asserts —
the figure sat in an R1-scoped section and was correct. The generalizable test runs
both ways: a figure is only misplaced if the claim it sits inside is false of its
referents. The residue: tag each per-revision figure with its revision *at the
figure*, not only in a heading above it
[slangpy#1050 authored churn / reconciliation-identifies-referent](../learnings/1786385910007-approver-clause-gap-slangpy-1050-authored-churn-is.md).

The size-cap short-circuit has a downstream cost worth logging: when a Step-1 FAIL
short-circuits a PR that is a follow-up to a known-risky area, the human reviewer
inherits the un-run challenger. slangpy#1101 (Logger deadlock fix) abstained on
`tier_eligible` (403 > 400) — but it is a direct follow-up to slangpy#1081, and prior
learnings target that exact file/risk class (lock-scope-reduction shifts a race onto
the callee; green CI can still be a hold on a symptom-only fix). If a future revision
drops under the cap or a human bumps the tier, the challenger WILL run and must apply
the #1081 probes (for each new flag/condition find its setter; verify both directions
of the COW publish race). Record the deferral so Step-0 recall links #1101→#1081
[size-cap short-circuit defers challenger](../learnings/1786479318515-approver-clause-gap-size-cap-short-circuit-defers-.md).

**Source learnings (13):**

- [slangpy#1050 vendored-share CORRECTION — 8726 lines/69%, not 7644/60%](../learnings/1786385423604-approver-clause-gap-correction-the-slangpy-1050-ve.md) — an enumeration presented as a measurement; compute aggregates with the tool, parts must sum to the whole.
- [slangpy#1050 authored churn 3926/3936; reconciliation identifies a referent, not a mistake](../learnings/1786385910007-approver-clause-gap-slangpy-1050-authored-churn-is.md) — audit accusations too; tag per-revision figures at the figure.
- [size-cap short-circuit defers the challenger on follow-ups to known-risky fixes](../learnings/1786479318515-approver-clause-gap-size-cap-short-circuit-defers-.md) — slangpy#1101←#1081; record the deferral so the challenger applies the #1081 probes on a later revision.
- [submodule-bump PRs are a review-harness blind spot → NO_REVIEW_SIGNAL](../learnings/1786485504819-approver-infra-abstain-slangpy-1103-submodule-bump.md) — CodeRabbit path-excludes external/**, Devin sees only the pointer; gather commit-range signals for the ledger, never self-approve.
- [CodeRabbit posts reviews as issue comments — harvest exit 20 is NOT "no review"](../learnings/1786969098327-approver-clause-gap-slangpy-coderabbit-posts-revie.md) — read coderabbitai[bot] issue comments and confirm the pinned head SHA.
- [Devin fetch on slangpy PRs frequently times out (~20m, exit 3)](../learnings/1786969110628-approver-infra-abstain-devin-fetch-on-slangpy-prs-.md) — best-effort secondary; only NO_REVIEW_SIGNAL when there is also no bot review.
- ["PR-triggered" and "advisory nit" are claims to verify at the source](../learnings/1787210533975-approver-critique-mustfix-pr-triggered-and-advisor.md) — read the workflow on: block and the run event; a bot's "required before merge" is the parsed verdict.
- [CI sanitizer-infra that downloads an unverified toolchain → OPEN_GAP](../learnings/1787210571422-approver-calibration-ci-sanitizer-infra-pr-that-do.md) — no checksum + credentialed runner + no owner-acceptance = supply-chain gap, not a nit.
- [slangpy external/slang-rhi submodule bumps correctly abstain on no_protected_paths](../learnings/1787903720357-approver-clause-gap-slangpy-external-slang-rhi-sub.md) — the guard recognizing an invisible submodule change; do not reclassify or widen policy.
- [ci_green_on_sha reads the COMBINED STATUS API, not check-runs; policy can change between revisions](../learnings/1788303100252-approver-clause-gap-ci-green-on-sha-reads-the-comb.md) — a red cross-repo status fails it while check-runs are green; read policy_version each time.
- [external/slang-rhi bump or oversize = deterministic Step-1 ABSTAIN — run eval-clauses first](../learnings/1788504229444-approver-process-slangpy-external-slang-rhi-bump-o.md) — pre-gate before poll+Devin; it is a POLICY reason, not NO_REVIEW_SIGNAL.
- [CodeRabbit review latency times out the 6-min harvest window on large slangpy PRs](../learnings/1788527120708-approver-infra-abstain-coderabbit-review-latency-t.md) — pending_bot=CodeRabbit to timeout on a >1000-line PR degrades to Devin-only; scale the window.
- [docs-only slang PRs now self-satisfy the SlangPy Tests status via a merged skip-job](../learnings/1788881023117-approver-clause-gap-docs-only-slang-prs-now-self-s.md) — a green SlangPy Tests on a docs-only PR may be synthetic; do not read as substantive coverage.
