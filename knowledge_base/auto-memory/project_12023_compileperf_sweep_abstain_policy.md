---
name: project_12023_compileperf_sweep_abstain_policy
description: "#12023 compile-perf complexity sweep — R1/R2/R4 ABSTAIN_POLICY (CI protected-path gate); MERGED 07-14 w/ human APPROVE = agreement, not false-safe. CLOSED"
metadata:
  node_type: memory
  type: project
  originSessionId: 2478fc41-f5cb-4054-a278-e865cb82091a
---

**✅ MERGED & CLOSED (2026-07-14T12:05Z, merge commit `bee6400c`).** Merged by author jvepsalainen-nv; human COLLABORATOR expipiplus1 APPROVED @ 06:26Z; `reviewDecision=APPROVED`. Merged **with both `.github/workflows/` files still edited** — exactly what every revision abstained on. **Calibration: agreement, not false-safe** — our ABSTAIN_POLICY (never WOULD_APPROVE) is the *designed* "human must look" path for protected-path changes; ABSTAIN rows are excluded from agreement scoring. Approver stamped `record_human_verdict=APPROVED` on all 3 decision rows (`a5c5b3e7cfe0`, `33be1040cdaa`, `790de4aa7c1b`) and filed an `[approver/human-agreement]` learning: protected-path ABSTAIN that merges with paths intact + human approval = correct terminal call; keep the deterministic-hold for structural-clause abstains. Review value confirmed: the 🟡 nits (CI `|| echo` masking, `∝N^0.00` degenerate fit, "scaling null" term, untested `linfit`/`powfit`) were **all fixed by the author** in "Address review:" commits before merge. Any further webhooks on this merged PR → no-op.

---

shader-slang/slang **PR #12023** "compile-perf: complexity sweep — scaling curves, floor+slope fits, sweep report" — maintainer-authored (jvepsalainen-nv), head `compile-perf-scaling-sweep` → `master`, label `pr: non-breaking`, 14 files / +1160−58. Python compile-perf **tooling only**, no compiler code. Supersedes draft #11674.

**Verdict (both revisions): ABSTAIN_POLICY** — reason `CLAUSE_FAIL:no_protected_paths`. PR edits two protected `.github/workflows/` files (`compile-perf-release-sweep.yml`, `nightly-mdl-perf-test.yml`); the mounted `v0-shadow-relaxed` policy routes protected-path changes to a human. Step-1 clause FAIL governs (runs before verdict parse), so the adversarial challenger didn't run. **Gate working as designed** — not a fault, not ABSTAIN_INFRA, not BLOCK.

- **R1** (head `790de4a`, decided 2026-07-10 ~08:45): ABSTAIN_POLICY. Review `APPROVE_WITH_NITS` — 0 bugs / 5 🟡 (1 pre-existing) / 0 questions. diff_hash `cecc55041fcc…`.
- **R2** (head `33be1040cdaa0548bfb62c55d9f59805caa89f72`, decided 2026-07-10 ~13:54, after a real `synchronize` push — 16 commits; new commit +5 lines manifest.py, plus a "dc803355 address review findings" commit): ABSTAIN_POLICY, **same governing reason** (CI-workflow edits persisted). Fresh A+C doc pinned to `33be104` (per-revision discipline — did NOT reuse R1 doc); new ledger row `shader-slang/slang#12023@33be1040cdaa`. Review `APPROVE_WITH_NITS` — 0 bugs / 5 🟡 / 0 questions. diff_hash `32f7c0b992fe…`, reverified. Critique gate caught a `CHALLENGER_CLEAN` label that wrongly implied an executed challenger → corrected to `NOT_RUN`.
- **R3** (head `0a9f284a99aa…`, dispatched 2026-07-13 ~08:33): **STALLED — no decision, no ledger row.** Reviewer A's R3 attempt failed the review guard on a permission-denial (inner CLI killed before subagent dispatch) + session teardown killed the A-retry and C. Cleanly superseded by R4, nothing to unwind. Runner-fragility datapoint (Reviewer A permission/tmp-race/budget fragility under shared checkout — R1's A/C were also lost to a teardown but recovered on re-dispatch; R3 is the first to cost a full round).
- **R4** (head `a5c5b3e7cfe041c4e03983084e2d66106cc37259`, decided 2026-07-13 ~19:55): ABSTAIN_POLICY, **same governing reason**. Fresh A+C doc pinned to `a5c5b3e7`; new ledger row `shader-slang/slang#12023@a5c5b3e7cfe0`. Review `APPROVE_WITH_NITS` — 0 bugs / 3 🟡 / 0 questions (+2 🔵 A nits, 4 🔵 C clarity). Notable gap both A&C flagged: CI `|| echo "no swept data yet"` swallows a genuine `sweep_report.py` crash as the benign no-data case; also `powfit` <2-positive-points fallback renders a fabricated `∝N^0.00`. Verified against **pinned** `a5c5b3e7` (compare API `master...a5c5b3e7`), NOT live head (which had moved to `b4087a64`) — a live-head mismatch here is the push, not a tmp-race. Handled a `commit_match` UNEVALUABLE (eval-clauses.py updated 2026-07-11 to require a `commit_id` field the doc predates) via Step-1b byte-verify + synthesized `_approver_result`.

All completed revisions: B/Devin **skipped** (no in-container Chrome → `reviewers_complete=false`, which independently also blocks WOULD_APPROVE).

**Nothing posted to GitHub** — approver in shadow mode (ledger-only, no write credential); reviewer unauthorized to post. Observability surface = shadow ledger + this record. Do NOT post on the approver's behalf.

**Routing lesson reinforced:** `pr_ready_for_review` → `*-pr-approver` (I mis-routed the first webhook to slang-reviewer; corrected on the 10th webhook when task string clarified). See [[feedback_webhook_dispatch_by_event]]. The reviewer's A/C pass wasn't wasted — approver consumed it. Don't spawn a second review pass when one is in flight.

**Systemic learning (approver-recorded):** under the relaxed shadow policy, `.github/**` stays in `protected_paths`, so any CI-touching PR systematically ABSTAIN_POLICY at Step 1 before the review verdict is read.

**Webhook re-fire discipline:** many duplicate `synchronize` webhooks; unchanged head → no-op, changed head → verify via `gh api .../pulls/12023 --jq .head.sha` first. But head-changed alone is NOT sufficient to re-dispatch — see the deterministic-hold rule below. Heads walked `790de4a`→`33be104`→`0a9f284`→`a5c5b3e7`→`af1c25bf`→`b4087a64` (author actively iterating 2026-07-13 evening).

**TERMINAL DECISION = R4 (`a5c5b3e7` = ABSTAIN_POLICY). Chain closed on our side.**

**DETERMINISTIC-HOLD RULE (this PR):** verdict is structurally invariant — the PR *inherently* adds a `sweep` input to both perf workflows, so `.github/workflows/*.yml` is touched in every revision → `no_protected_paths` FAILs on every head. No push flips it. Approver is shadow-mode (nothing posted to GitHub), so re-running only refreshes a private ledger doc the author can't see and isn't responding to (their "Address review" commits iterate on the PUBLIC review channel, not ours). **Do NOT dispatch a fresh pass on routine `synchronize` churn — even quiet-head + material delta.** R5 was explicitly declined 2026-07-13. See shared learning "Deterministic-ABSTAIN PRs — stop re-running on churn". [[feedback_debounce_pr_review_on_churn]]

**Re-trigger ONLY if:** (1) protected-path edits removed (verdict could flip), (2) human maintainer explicitly requests our review, or (3) PR moving to merge and current-state review needed on record. A substantive human comment re-opens via the same route (slang-pr-approver, canonical thread `gh-issue-shader-slang/slang-12023`). Otherwise: maintainer (author) owns the CI-workflow eyeball + the merge.
