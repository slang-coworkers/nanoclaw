---
name: project_nanoclaw_pr874_webhook_route_approver
description: "CANONICAL routing rule for slang-coworkers/nanoclaw fork PRs: a pr_ready_for_review / @-mention webhook carries the generic post-#874 'route to *-pr-approver' task string, but NO nanoclaw approver is wired — so every nanoclaw-fork PR is handled INLINE by Main, never routed to a product (slang/slangpy) approver/reviewer; merge is the maintainer's (or bot self-merge within the nv-coworkers grant). ~90 sibling leaves cite this as 'the standing rule'."
metadata:
  node_type: memory
  type: project
  originSessionId: pr874-webhook
---

# nanoclaw-fork PR routing — the standing rule (this is the hub the siblings cite)

**THE RULE.** A `slang-coworkers/nanoclaw` PR fires a `pr_ready_for_review` (or `@nv-slang-bot` mention) webhook whose task string — set by the #874 fix itself — says *"route reviewable PRs to the project's `*-pr-approver` coworker (never a reviewer/fixer)."* **That string is for PRODUCT repos (shader-slang/slang, slangpy).** The nanoclaw fork is platform infra: it is **not in the product-coworker routing map and has NO `nanoclaw-*-pr-approver`/`nanoclaw-reviewer` wired**, so a slang/slangpy COMPILER approver at a nanoclaw-repo PR is nonsensical. ⇒ **Every nanoclaw-fork PR is handled INLINE by Main — NOT routed, NOT dispatched to a product approver.** Merge is the maintainer's (szihs = haaggarwal), or a bot self-merge within the [[feedback_nv_coworkers_automerge]] grant. Same repo-class as [[project_nanoclaw_pr873_sync_nvmain]] / #864 / #868 / #871. No content verdict is relayed without receipts ([[feedback_never_relay_a_verdict_not_in_hand]]).

**#874 itself** (`fix(webhook): route reviewable PRs to *-pr-approver not reviewer`, `fix/haaggarwal/webhook-route-pr-approver` → `nv-main`, bot-authored) is the PR that introduced this task string. Meta-irony: its own trigger webhook arrived with the STALE string it fixes. The fix changes routing for future PRODUCT webhooks; it does **not** change how nanoclaw-fork PRs are handled (still inline, never routed).

## Recurring PR classes seen through this webhook (all resolved the same way)

Between #874 and #1184 (2026-07-10 → 2026-08-10) ~140 nanoclaw-fork PRs came through this webhook. Each was a point-in-time disposition of THE RULE above; the per-PR snapshots are pruned (store doctrine: superseded snapshots are compaction working as designed). They fall into these classes:

- **KB-snapshot self-merge** (`kb-sync-YYYYMMDD` → `nv-coworkers`, nightly `task-1781522302095-mjy6s1` 03:00 UTC): e.g. #1023/#1029/#1042/#1045/#1062. All-under-`knowledge_base/`, **already MERGED at webhook arrival** (self-merged in seconds via REST within the `nv-coworkers` grant). Pure no-op — not routed, not reviewed-for-routing, not commented.
- **CHANGELOG-NV daily-refresh self-merge** (`docs/changelog-nv-YYYYMMDD` → `nv-coworkers`, docs-only single-file): e.g. #925/#957/#965/#974/#987/#995/#1010/#1015/#1022/#1041/#1155/#1184. Merged-at-arrival within the grant. Pure no-op.
- **`sync/upstream-*` maintainer-await** (`sync/upstream-nv-{slang,slangpy,main,coworkers}`, `sync-upstream.sh`): e.g. #889/#978/#991/#999/#1026/#1047/#1049/#1050/#1052. Larger real-code syncs into the `nv-*` overlay branches. Handled inline; merge/CI-reconciliation is the maintainer's. **The hardened-image (ECR agent-image pin + `verify-agent-image.yml`) landed across this class and produced the `verify` red saga — see next section.**
- **One-off inline fixes** (human- or bot-authored, dashboard/compose/etc.): e.g. #1039 (`derive is_owned from nv-main.txt`), #1046 (human davidchunv, `dashboard/server.ts` supplies missing `instance` column on the `messaging_groups` INSERT — reviewed inline clean/correct/minimal). Resolved; merge maintainer's.

**On any redelivery** of a member of these classes: no-op unless a NEW state lands (CI flips, a substantive non-bot comment, or a not-yet-terminal PR reaches a verdict).

## The `verify-agent-image.yml` first-introduction defect (sync-class sub-saga)

Full dedicated leaf: **[[project_nanoclaw_1051_agent_image_guard_selfblock]]**. Summary: the sync PRs that first introduce the `agent-image` ECR digest pin (#1047/#1049/#1050/#1052) had `verify` RED at its first step "Resolve the pin change". Cause (locally reproduced with a control pair): `read_pin` ends in `grep -o '"agent-image"…'`; the **base** commit has no `agent-image` key (this very PR introduces it), so `grep` exits 1, and under `set -euo pipefail` the failing pipe stage aborts `OLD="$(read_pin base)"` before the shape guards run — hence zero stdout and all downstream ECR/manifest/signature steps SKIPPED. **The workflow cannot survive its own introduction.** Upstream's actual fix was a job-level **`if: github.base_ref == 'main'`** guard (a fork's `nv-*` branch has no OIDC role / signer identity, so every step would fail on a missing credential, not the image; trust is inherited from the verified `main` merge) — which makes `verify` SKIP on fork branches. The `|| true`-on-grep fix for `main`-targeting first-pin PRs was added too but is NOT what greened the fork PRs. ⚠️ The empty-OLD/`pipefail` defect remains MOOT-on-forks but unfixed for a first-time pin add whose base IS `main`; do not restate it as "fixed".

## Open question — carry forward (NOT resolved elsewhere)

⚠️ **Is a `sync/upstream-*` self-merge inside the bot's grant?** [[feedback_nv_coworkers_automerge]] grants standing self-merge authority **only for `nv-coworkers`**. My own records CONTRADICT each other on `sync/upstream-*` into the other overlay branches: #997/#989/#1032 say those "await the maintainer, outside the grant," while #868 records nv-slang-bot self-merging a `sync/upstream-nv-main` PR ~5 min after opening and calls it "within standing fork auto-merge authority" (also #1090, nv-slangpy self-merge mid-investigation). **Unresolved.** Moot for any single terminal chain (a merge is not mine to undo) but must be settled before treating a future `sync/upstream-*` self-merge on a NON-`nv-coworkers` branch as expected.

## Related

[[feedback_nv_coworkers_automerge]] (the grant + exact REST-only permission reality) · [[project_nanoclaw_pr873_sync_nvmain]] (same repo-class, inline-not-routed) · [[project_nanoclaw_1051_agent_image_guard_selfblock]] (the verify saga) · [[feedback_never_relay_a_verdict_not_in_hand]] · [[project_github_actions_graphql_401_outage]] (a real infra outage that hit this class's tooling).
