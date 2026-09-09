---
title: Approver clause, policy, and severity calibration for CI/config PRs
type: concept
group: ci-tooling
tags: [approver, policy-version, protected-paths, open-gap, block, abstain, human-agreement, per-revision, reachability]
source_count: 17
---

## TL;DR

Two things drive an approver's verdict on a CI/tooling PR: the *effective mounted policy*
(clauses) and the *severity* the challenger assigns a gap. Both are calibrated here against
real human-verdict joins (merged / closed-unmerged at the exact decided head).

- **Policy is a moving target; read it live, never from recall.** `v0-shadow-wide` (signed
  2026-08-04) REMOVED `.github/**` and `*.yml` from `protected_paths` — now only
  `**/slang-tag-version.h` is terminal, and size caps grew. Recall rows saying ".github/** is
  protected" are era-correct for `v0-shadow-relaxed` but STALE, and dominate Step-0 recall by
  keyword. Run `eval-clauses.py`, read the emitted `policy_version`; the clause reading the
  live mounted policy wins over any memory.
- **Reachability-probe parameter-dependent findings before treating them as blocking.** A 🔴
  in a CLI tool that depends on a `--flag`/env/`DEFAULT_*` clears (advisory) if the only
  deployed invocation uses the default where the assumption holds. Existence-verified ≠
  reachability-verified.
- **Gap severity discriminators (from human joins):** prefer ABSTAIN/advisory over BLOCK for a
  *latent coverage-narrowing* or *deployment-dependent operational* risk; a gap on an
  *additive/opt-in* path proven a no-op elsewhere is a NIT, not OPEN_GAP; a *best-effort
  producer with silent fall-through* declares its output optional → clear. Reserve BLOCK for a
  reproducible wrong-result-NOW (e.g. a self-declared "land #X first" dependency where #X is
  still open and affected inputs still exist on master).
- **Per-revision discipline:** re-run the FULL clause procedure each revision (a fix can flip
  WHICH clause fails); a prior WOULD_APPROVE is a prior to RE-DERIVE, not defend; on a
  `synchronize`, sha256 the `gh pr diff` vs the prior row before re-deriving.
- **Don't manufacture ABSTAIN_INFRA** off a flaky `compare` 404 — resolve paths/size from
  endpoints that don't flake.

Repeated calibration signal: most of these ABSTAINs were over-conservative (merged unchanged
at the decided head). Abstain never blocks, so the cost is low — but the class resolves toward
approve when the owner holds facts the diff can't carry.

## Read the live policy — the protected-path era is a moving target

Three atoms document the same trap: Step-0 recall confidently predicts a terminal
`ABSTAIN_POLICY:CLAUSE_FAIL:no_protected_paths` for a `.github/**` PR, and the live policy
returns the opposite.
[v0-shadow-wide REMOVED .github/** from protected_paths](../learnings/1786991606872-approver-clause-gap-v0-shadow-wide-removed-github-.md)
explains the rationale: in shadow mode the human is the final gate, so a Step-1 terminal FAIL
"protects nothing and only destroys measurement signal" — measured on 232 decisions, 91% of
abstains with a decisive human verdict were approved, and `no_protected_paths` fired
exclusively on `.github/**` (all CI-workflow/docs). The pre-2026-08-04 learnings that say
"relaxed shadow policy STILL protects .github/**" are era-correct but stale and dominate recall
by keyword.
[CI-only workflow-pin PR under v0-shadow-wide: clauses pass, merged same-head = agreement](../learnings/1787145415990-approver-human-agreement-ci-only-workflow-pin-pr-u.md)
confirms with a clean merge join: a recalled policy fact is a claim about a mounted file's PAST
state, and the mount can change under you — the eval-clauses.py output is authoritative, recall
is only a prior. (NB the policy's own `_comment` flags `.github/workflows/**` as a supply-chain
surface to RE-protect before real enforcement, so this APPROVE-eligibility is shadow-mode
specific.) The subtler cousin:
[ci-analytics PRs are NOT auto-protected-path — check the file list, not the title](../learnings/1786462450659-approver-clause-gap-ci-analytics-prs-are-not-auto-.md)
— "ci-analytics" spans `.github/workflows/ci-analytics.yml` (protected) AND `extras/ci/analytics/**`
(plain Python, not protected); only the changed-path list tells you which, and a stale
`compare` may list `.github/**` files from an intervening master-merge that are NOT the PR's.

Don't invert this into manufacturing an infra abstain either.
[eval-clauses compare master...head can flake 404 — don't manufacture ABSTAIN_INFRA](../learnings/1786979810059-approver-infra-abstain-eval-clauses-compare-master.md):
the `/compare/{base}...{head}` endpoint is intermittently 404 on slang, knocking out both
`no_protected_paths` and `tier_eligible` (both derive from that one array) and looking like a
real infra gap. The infra gate must name a GENUINE defect; resolve protected-paths from
`gh pr diff --name-only` and size from `pulls/<pr>` scalars, and record the clauses PASS noting
the compare flaked — recording ABSTAIN_INFRA off a transient 404 burns the gate for no defect.

## Reachability and gap severity — calibrated against human joins

The strongest calibration comes from BLOCKs and OPEN_GAP abstains that the human overruled by
merging unchanged. `ci_health.py` produced two:
[BLOCK ran hot on ci_health.py #12481 — probe DEPLOYED-path reachability](../learnings/1786539771962-approver-human-disagreement-block-ran-hot-on-ci-he.md)
shows a verified Devin 🔴 (hard-coded repo in a PR-link cell) that is DEAD on the supported path
— the only invocation never passes `--repo`, so the flag-dependent branch can't fire in
deployment. The rule this violates was already in the skill (a gap clears when "the trigger is
unreachable on the supported path"), and it applies to a 🔴 severity marker too: a 🔴 is the
reviewer's PRIOR, not the verdict; verify severity, not just existence. One-command probe:
`grep -rn "<toolname>" .github/workflows/ scripts/ | grep -- "--<flag>"`.

Several OPEN_GAP abstains were over-caution, each teaching a severity discriminator:

- [OPEN_GAP abstain on a deployment-dependent CI-ops risk was overruled](../learnings/1787149927626-approver-human-disagreement-open-gap-abstain-on-a-.md)
  — an unauthenticated `releases/latest` lookup per VM boot (rate-limit risk) merged unchanged
  because whether 60/hr is approached depends on deployment facts (NAT topology, boots/hour)
  that live with the fleet owner, and the author documented the incident history INTO the PR. For
  a *deployment-dependent operational risk*, if the risk is resolvable only with facts absent from
  the diff AND the author demonstrably operates the system, the honest severity is advisory.
- [no CI on an additive opt-in path is a nit not OPEN_GAP when the change is a proven no-op](../learnings/1787829221727-approver-human-disagreement-no-ci-on-an-additive-o.md)
  — a `${CMAKE_BINARY_DIR}`→`${slang_BINARY_DIR}` change is a provable no-op on every CI-covered
  path; the only behavior delta is on an additive submodule path nobody in-repo uses. "Undermines
  the stated purpose" over-fires when the purpose is an opt-in capability rather than behavior
  every user gets. Three questions: proven no-op on covered paths? behavior-changing path additive
  and opt-in? trusted maintainer engaged at head?
- [a composite-action lint-coverage narrowing shipped merged-as-is](../learnings/1787677651948-approver-human-disagreement-a-composite-action-lin.md)
  — a `paths:` filter that narrows a linter's coverage merged unchanged; prefer ABSTAIN/advisory
  over BLOCK for a *latent coverage-narrowing* gap (a removed safety net that might catch a future
  error), reserving BLOCK for a wrong-result-now. (Honest caveat: merged-as-is could mean "accepted
  the tradeoff" or "nobody noticed" — it lowers block-confidence, doesn't prove the gap harmless.)
- [#12794 ABSTAIN(OPEN_GAP) overruled — a best-effort producer with silent fall-through](../learnings/1787840426446-approver-human-disagreement-12794-abstain-open-gap.md)
  — a removed test assertion cleared because the producer (`if (sourceFile) addFileDependency(...)`,
  silent fall-through) DECLARES the output optional. Distinguish "deliberate" from "contractual":
  `if (x) add(x);` is deliberate-but-optional; a hard require-with-diagnostic is contractual and
  its assertion-removal holds OPEN_GAP.

The producer-inventory rule also has a genuine ABSTAIN case:
[producer-side decoration removal — weigh owner-intent vs documented consumer contract](../learnings/1787265120108-approver-challenger-producer-side-decoration-remov.md)
— removing the sole producer of `IRPublicDecoration` strips it from every plain-`public` decl,
and `docs/cpu-target.md` documents exactly that as the host-export mechanism with no test. Architect
intent rules out BLOCK; a silently-regressed documented contract with no doc/test update rules out
APPROVE → ABSTAIN so a human reconciles. And the one clear BLOCK:
[a PR's self-declared "land #X first" dependency is a live CI-break until #X is merged AND master is clean](../learnings/1787681981718-approver-challenger-miss-guard-a-pr-s-self-declare.md)
— a new guard rejects inputs that still exist on master; "should land first" + dependency still
OPEN + affected inputs present = a reproducible CI break at merge = BLOCK, corroborated by three
independent signals (Devin 🔴, failed Windows jobs on head, human reviewer). Probe current master
(not a stale local clone) for the inputs the guard would reject.

## Per-revision discipline and synchronize handling

[A prior revision's WOULD_APPROVE is a prior to RE-DERIVE, not defend](../learnings/1787654279957-approver-challenger-miss-a-prior-revision-s-would-.md):
byte-identical code approved at R3/R4 hid a false-green pass-floor hole in a test harness's own
self-verification (green while running/asserting nothing) that R5's more thorough review
surfaced. Anchoring on your own prior verdict is exactly what the challenger exists to break — a
later revision's stronger review can reverse an earlier generous approve on an unchanged property.
A false-green in a harness's OWN self-verification undermines the PR's purpose → OPEN_GAP, distinct
from ordinary incomplete-coverage-of-unchanged-code (which clears).
[A fix revision can flip WHICH Step-1 clause fails](../learnings/1788131625046-approver-clause-gap-a-fix-revision-can-flip-which-.md)
extends it: R1 abstained on `ci_green_on_sha` (a reproduced SIGSEGV), R2 fixed it green but grew
past the size cap → abstained on `tier_eligible`. Re-run the full procedure every revision; verify
"prior crash fixed" via CI-green on the EXACT test (no local rebuild); synthesize the review-doc
BEFORE eval-clauses (it reads the embedded commit_id); watch for a fix cascading a new 🔴 (a fresh
`SLANG_RELEASE_ASSERT` fires in release too). The cheap synchronize shortcut:
[on a synchronize, sha256 the gh pr diff vs the prior row](../learnings/1787804928751-approver-challenger-miss-on-a-synchronize-sha256-t.md)
— a rebase or no-op cleanup moves the head without changing the net PR; identical diff hash ⇒ the
prior decision holds verbatim (new ledger row still required, keyed on commit_sha). Don't trust
commit messages ("Fix X") or the rebase-polluted compare file list; a mid-load empty Devin capture
is VOID evidence (returns to UNKNOWN), and a COMMENTED "mostly fine" human review is neither approve
nor block.

## DO-NOT-MERGE vs genuine hardening: intent dominates the bot signal

Two confirmed joins pin the disambiguator for a CI-YAML PR carrying harvest-exit-20 + clean Devin.
[DO-NOT-MERGE CI-YAML repro PR abstain (CHALLENGER_CONCERN) confirmed by close-unmerged](../learnings/1787328599550-approver-confirmed-do-not-merge-ci-yaml-repro-pr-a.md):
for a PR marked throwaway/"DO NOT MERGE" whose diff only disables CI or inserts a repro loop, the
near-certain outcome is close-unmerged → ABSTAIN, and the clean-bot signal (CodeRabbit auto-skips
the title) is a red herring sliding toward approval. Its complement:
[CI-YAML template-injection hardening (harvest exit 20 + Devin clean) is safe to WOULD_APPROVE when intent is genuine](../learnings/1787858402358-approver-confirmed-ci-yaml-template-injection-hard.md)
— a genuine hardening (`Fixes #<issue>`, no repro label) merges. Together: the disambiguator is
**intent/effect, NOT the bot signal**; harvest-exit-20 is expected on workflow PRs, not suspect. The
load-bearing check for a hardening PR is a static scan of every `run:` block for residual `${{ }}` —
green CI never proves the changed steps behave.

## Readers through a deleted/nullable field

[Deleting a field a REPORT reads through silently blanks every docstring-derived blurb](../learnings/1786455776539-approver-clause-gap-deleting-a-field-a-report-read.md):
making `gen` optional left `getdoc(x) if x else ""` guards falling to `"(no description)"` — valid
Python, still a string, page still renders, CI blind. When a diff makes a field optional/nullable,
enumerate EVERY reader tree-wide (dangerous ones have an `or`/ternary fallback that converts missing
into wrong); a field read for *metadata* (docstring, `__name__`) is easy to miss, and a
partially-migrated file is evidence of an incomplete sweep. An introduced user-visible regression in
a file the PR edits is OPEN_GAP (discriminator: did the PR make it worse), not a nit.

**Source learnings (17):**

- [Deleting a field a REPORT reads through silently blanks every docstring-derived blurb](../learnings/1786455776539-approver-clause-gap-deleting-a-field-a-report-read.md) — a `getdoc(x) if x else ""` guard fails silently to a plausible default; enumerate every reader when a field goes optional; metadata reads are easy to miss.
- [ci-analytics PRs are NOT auto-protected-path — check the file list, not the title](../learnings/1786462450659-approver-clause-gap-ci-analytics-prs-are-not-auto-.md) — "ci-analytics" spans protected .github/ and unprotected extras/ci/analytics/; run eval-clauses first; a stale compare lists intervening-merge .github files that aren't the PR's.
- [BLOCK ran hot on ci_health.py — probe DEPLOYED-path reachability](../learnings/1786539771962-approver-human-disagreement-block-ran-hot-on-ci-he.md) — a verified 🔴 depending on a --flag/DEFAULT clears if no caller sets a non-default value; existence-verified ≠ reachability-verified; the critique gate pushed stricter, wrongly.
- [eval-clauses compare master...head can flake 404 — don't manufacture ABSTAIN_INFRA](../learnings/1786979810059-approver-infra-abstain-eval-clauses-compare-master.md) — one flaky compare knocks out no_protected_paths + tier_eligible; resolve from gh pr diff --name-only + pulls scalars; recording infra-abstain off a 404 burns the gate.
- [v0-shadow-wide REMOVED .github/** from protected_paths](../learnings/1786991606872-approver-clause-gap-v0-shadow-wide-removed-github-.md) — only **/slang-tag-version.h is terminal now; stale relaxed-era recall dominates by keyword; the clause reading live policy wins; .github/workflows to be re-protected at enforcement.
- [CI-only workflow-pin PR under v0-shadow-wide: clauses pass, merged same-head = agreement](../learnings/1787145415990-approver-human-agreement-ci-only-workflow-pin-pr-u.md) — a dxvk-remix SHA-pin merged at the decided head; read policy_version from eval-clauses, never hand-judge a protected path from recall; the mount can change under you.
- [OPEN_GAP abstain on a deployment-dependent CI-ops risk was overruled](../learnings/1787149927626-approver-human-disagreement-open-gap-abstain-on-a-.md) — an unauth releases/latest per-boot lookup merged as-is; deployment-dependent risk with an author who operates the fleet is advisory; reading source at head beat Devin's false clearance.
- [producer-side decoration removal — weigh owner-intent vs documented consumer contract](../learnings/1787265120108-approver-challenger-producer-side-decoration-remov.md) — architect-intended removal breaks a documented CPU-export contract with no test; intent rules out BLOCK, silent doc regression rules out APPROVE → ABSTAIN.
- [DO-NOT-MERGE CI-YAML repro PR abstain confirmed by close-unmerged join](../learnings/1787328599550-approver-confirmed-do-not-merge-ci-yaml-repro-pr-a.md) — a throwaway/repro CI PR near-certainly closes unmerged → ABSTAIN; the clean-bot signal slides toward approve, the intent marker dominates.
- [A prior revision's WOULD_APPROVE is a prior to RE-DERIVE, not defend](../learnings/1787654279957-approver-challenger-miss-a-prior-revision-s-would-.md) — a false-green pass-floor hole in a harness's self-verification, present since R3, surfaced at R5; re-derive severity from code not from "I already approved this."
- [A composite-action lint-coverage narrowing shipped merged-as-is](../learnings/1787677651948-approver-human-disagreement-a-composite-action-lin.md) — prefer ABSTAIN/advisory over BLOCK for a latent coverage-narrowing gap; R1's BLOCK over-blocked, R2's ABSTAIN aligned; merged-as-is has two readings.
- [A PR's self-declared "land #X first" dependency is a live CI-break until #X merges](../learnings/1787681981718-approver-challenger-miss-guard-a-pr-s-self-declare.md) — a new guard rejecting inputs still on master + an open dependency PR = reproducible CI break = BLOCK; grep CURRENT master, not the stale local clone.
- [On a synchronize, sha256 the gh pr diff vs the prior row](../learnings/1787804928751-approver-challenger-miss-on-a-synchronize-sha256-t.md) — a rebase/no-op moves the head without changing the net PR; identical diff hash ⇒ prior decision holds; a mid-load empty Devin capture is VOID; a COMMENTED review neither approves nor blocks.
- [No CI on an additive opt-in path is a nit not OPEN_GAP when the change is a proven no-op](../learnings/1787829221727-approver-human-disagreement-no-ci-on-an-additive-o.md) — a CMAKE_BINARY_DIR→slang_BINARY_DIR no-op on covered paths merged as-is; "undermines the stated purpose" over-fires when the purpose is opt-in.
- [#12794 ABSTAIN(OPEN_GAP) overruled — a best-effort producer with silent fall-through](../learnings/1787840426446-approver-human-disagreement-12794-abstain-open-gap.md) — a removed assertion cleared because `if (x) add(x)` declares the output optional; distinguish deliberate-but-optional from contractual.
- [CI-YAML template-injection hardening is safe to WOULD_APPROVE when intent is genuine](../learnings/1787858402358-approver-confirmed-ci-yaml-template-injection-hard.md) — the complement to the DO-NOT-MERGE learning; intent/effect not the bot signal disambiguates; static-scan every run: for residual ${{ }}, don't rest on green CI.
- [A fix revision can flip WHICH Step-1 clause fails](../learnings/1788131625046-approver-clause-gap-a-fix-revision-can-flip-which-.md) — R1 ci_green_on_sha → R2 tier_eligible (fix + coverage inflated the diff); verify "crash fixed" via CI-green on the exact test; a fix's new SLANG_RELEASE_ASSERT is a release-abort regression.
