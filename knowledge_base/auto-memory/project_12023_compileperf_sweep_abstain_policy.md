---
name: project_12023_compileperf_sweep_abstain_policy
description: "#12023 compile-perf complexity sweep — reviewed R1+R2, both ABSTAIN_POLICY (CI-workflow protected-path gate), maintainer owns merge, TERMINAL @ 33be104"
metadata:
  node_type: memory
  type: project
  originSessionId: 2478fc41-f5cb-4054-a278-e865cb82091a
---

shader-slang/slang **PR #12023** "compile-perf: complexity sweep — scaling curves, floor+slope fits, sweep report" — maintainer-authored (jvepsalainen-nv), head `compile-perf-scaling-sweep` → `master`, label `pr: non-breaking`, 14 files / +1160−58. Python compile-perf **tooling only**, no compiler code. Supersedes draft #11674.

**Verdict (both revisions): ABSTAIN_POLICY** — reason `CLAUSE_FAIL:no_protected_paths`. PR edits two protected `.github/workflows/` files (`compile-perf-release-sweep.yml`, `nightly-mdl-perf-test.yml`); the mounted `v0-shadow-relaxed` policy routes protected-path changes to a human. Step-1 clause FAIL governs (runs before verdict parse), so the adversarial challenger didn't run. **Gate working as designed** — not a fault, not ABSTAIN_INFRA, not BLOCK.

- **R1** (head `790de4a`, decided 2026-07-10 ~08:45): ABSTAIN_POLICY. Review `APPROVE_WITH_NITS` — 0 bugs / 5 🟡 (1 pre-existing) / 0 questions. diff_hash `cecc55041fcc…`.
- **R2** (head `33be1040cdaa0548bfb62c55d9f59805caa89f72`, decided 2026-07-10 ~13:54, after a real `synchronize` push — 16 commits; new commit +5 lines manifest.py, plus a "dc803355 address review findings" commit): ABSTAIN_POLICY, **same governing reason** (CI-workflow edits persisted). Fresh A+C doc pinned to `33be104` (per-revision discipline — did NOT reuse R1 doc); new ledger row `shader-slang/slang#12023@33be1040cdaa`. Review `APPROVE_WITH_NITS` — 0 bugs / 5 🟡 / 0 questions (author closed several R1 nits; remaining are doc-accuracy README `breakdown.py` row, duplicated linear-expectation formula `sweep_report.py:181`&`:296`, dead code in `write_sweep_pages`, metric-naming inconsistency, untested `linfit`/`powfit`). diff_hash `32f7c0b992fe…`, reverified at new head; codex confirmed no R1 hash leakage. Critique gate caught a `CHALLENGER_CLEAN` label that wrongly implied an executed challenger → corrected to `NOT_RUN`.

Both revisions: B/Devin **skipped** (no in-container Chrome → `reviewers_complete=false`, which independently also blocks WOULD_APPROVE).

**Nothing posted to GitHub** — approver in shadow mode (ledger-only, no write credential); reviewer unauthorized to post. Observability surface = shadow ledger + this record. Do NOT post on the approver's behalf.

**Routing lesson reinforced:** `pr_ready_for_review` → `*-pr-approver` (I mis-routed the first webhook to slang-reviewer; corrected on the 10th webhook when task string clarified). See [[feedback_webhook_dispatch_by_event]]. The reviewer's A/C pass wasn't wasted — approver consumed it. Don't spawn a second review pass when one is in flight.

**Systemic learning (approver-recorded):** under the relaxed shadow policy, `.github/**` stays in `protected_paths`, so any CI-touching PR systematically ABSTAIN_POLICY at Step 1 before the review verdict is read.

**Webhook re-fire discipline:** ~11 duplicate `synchronize` webhooks fired at head `790de4a` → all no-op (silence). The one at `updated_at 2026-07-10T13:07:16Z` was a REAL head move (`790de4a`→`33be104`) — verified via `gh api .../pulls/12023 --jq .head.sha` before re-dispatching. **Rule: on a `synchronize` webhook, compare head SHA vs last-decided head; unchanged → no-op, changed → re-dispatch to approver.**

**Next:** maintainer (author) owns the merge; a human eyeballs the two CI-workflow edits per the gate. Further `synchronize` at `33be104` (unchanged head) → no-op. A new head SHA → re-dispatch to slang-pr-approver on canonical thread `gh-issue-shader-slang/slang-12023`. A substantive human comment (nit follow-up, re-review request) re-opens: same route.
