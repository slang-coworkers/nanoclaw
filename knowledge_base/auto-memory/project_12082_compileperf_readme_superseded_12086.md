---
name: project_12082_compileperf_readme_superseded_12086
description: "slang#12082 compile-perf README/timer-contract CLOSED(unmerged), folded into live"
metadata: 
  node_type: memory
  type: project
  originSessionId: 2676e0c9-bb2a-42cf-8aee-0f2ed63d1ef2
---

shader-slang/slang **#12082** ("compile-perf: README refresh + api timer glossary", author jvepsalainen-nv) is **CLOSED unmerged — benign supersede, NOT a merits rejection**. Author folded it into **#12086** per maintainer decision (README edits of the two PRs conflicted; full glossary content preserved there, merge commit cbbf364).

Approver ledger arc (shadow, `v0-shadow-relaxed`): `bb8da613` ABSTAIN_POLICY(OPEN_GAP) → `d23f8eb5` WOULD_APPROVE → `e04ce4ff` WOULD_APPROVE → `52d235ef` ABSTAIN_POLICY(OPEN_GAP) → closed/superseded. The two WOULD_APPROVE rows are NOT false-safes — recorded as CLOSED_UNMERGED_SUPERSEDED.

**Live successor = #12086.** When its `pr_ready_for_review` webhook arrives, route to `slang-pr-approver` as normal (canonical thread `gh-issue-shader-slang/slang-12086`). Two things travel into it:
1. **Unresolved rev4 OPEN_GAP** — the "leaf `Scope` wraps exactly ONE public API call; composites = apiTotal/apiReflection/apiCreateSession" invariant is contradicted by two loop-wrapping timers `apiWriteModule` (4 calls × N modules) + rt-composite `apiFindEntryPoint` (findEntryPointByName ×3). Traveled verbatim to #12086 `api-driver.cpp:29-30`. Enumerated-exception invariants ("all X except {A,B,C}") need a completeness check against every scope.
2. **#12086 touches `.github/workflows/**`** (protected paths) → will route ABSTAIN_POLICY on protected paths regardless (same class as [[project_12023_compileperf_sweep_abstain_policy]]).

Approver already knows both and will surface the carried gap in its #12086 review — no pre-emptive dispatch needed; just route the webhook when it fires.

**#12086 DECIDED 2026-07-14 — ABSTAIN_POLICY @ `40480d3f7b37` (settled head after a 3-synchronize burst; supersedes `ad8bc58b9526`).** reason_code `CLAUSE_FAIL:no_protected_paths` — PR modifies `.github/workflows/compile-perf-release-sweep.yml` + `nightly-mdl-perf-test.yml` (policy `protected_paths=[".github/**"]`). Deterministic Step-1 hold ⇒ challenger did not run. Primary tier (github-actions[bot], diff_hash 39b7679) clean of bugs (0🔴/3🟡/6🔵); CodeRabbit corroborates (1 nit on breakdown.py); Devin timed out (>40min, non-authoritative). Loop-timer OPEN_GAP NOT re-triggered — this PR's only C++ change is a comment. **This is now a deterministic structural abstain like [[project_12023_compileperf_sweep_abstain_policy]] — do NOT re-run the approver on further synchronize churn; it holds the same way until a human maintainer reviews the two YAMLs.** Next: human verdict on merge; approver joins it. Chain terminal.

**07-14 later — verified during a ~12-event synchronize burst.** Author is actively rebasing (head moved `40480d3f`→`79b542721e`, 4 surviving commits e4362f8/5b025d3/7ec30f0/79b5427; PR OPEN+MERGEABLE). Confirmed head `79b542721e` STILL modifies both `.github/workflows/{compile-perf-release-sweep,nightly-mdl-perf-test}.yml` → protected-path gate still fires, verdict UNCHANGED. Confirms the structural-abstain: churn is real author iteration, not a webhook re-delivery loop, and does not move the decision. One read-only `gh pr view` per abnormal burst is enough to disambiguate — do NOT re-dispatch the approver or escalate the operator on synchronize churn. Only re-decide if a future head DROPS the `.github/**` files (would flip to an approve-path).

**07-15 10:22Z — TERMINAL: #12086 MERGED** (merge-commit `42916308`, head at merge `cdba22a0`). Approver processed the human-verdict join: **APPROVED-equivalent @ decision commit `40480d3f`, calibration = AGREEMENT (not a false-safe).** The `.github/**` ABSTAIN_POLICY said "a human must look" and one did — ~21h active review, 4+ more "Address review" commits (gate imports at PR time, multi-bucket fixture, generator smoke checks) between the decision commit and merge. Confirms the protected-path gate is well-calibrated for the compile-perf/CI-tooling class (#12023/#12084/#12090) — heavy human review even when bot review is clean of bugs. Approver learning `[approver/human-disagreement]` + `pr-12086-awaiting-join.md` reflect MERGED-agreement. **Chain fully closed — ignore any further #12086 webhooks (trailing pre-merge churn).**
