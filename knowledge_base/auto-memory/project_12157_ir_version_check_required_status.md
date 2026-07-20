---
name: project-12157-ir-version-check-required-status
metadata: 
  node_type: memory
  type: project
  originSessionId: f47a5b63-d46a-4309-a3ce-97f5b86becd4
---

**#12157** (shader-slang/slang) — "Make the IR-instruction version-bump check a required status check". Bot-filed follow-up requested on PR #12133 (which added `kIROp_ImageGatherOffset`, needed a manual 25→26 bump after the advisory comment fired).

**Problem:** The `⚠️ IR Instruction Files Changed` advisory (marker `<!-- slang-ir-version-check -->`) can't be a *required* branch-protection check. Two design gaps confirmed @HEAD c6a261068:
1. `extras/check-inst-version-changes.sh` emits `::warning::` + `exit 0` on the needs-bump path → the `pull_request`-event step always reports success.
2. The poster job in `.github/workflows/check-ir-version.yml` runs on `workflow_run` (default-branch ctx) → reports no PR-head status → branch protection can't require it.

**Triage:** enhancement (CI/infra) / low / CI / P3. Verdict posted as issue comment 5013932488.

**Recommended fix (Approach A):** add `--enforce` (exit 1) mode to `check-inst-version-changes.sh` + a dedicated `pull_request`-event job wired into the existing `check-ci` aggregate (ci.yml:642). That aggregate is the single required check, so adding the job to its `needs` makes it required automatically. Mirrors precedents check-cmdline-ref + Check-Stable-Names. Keep the advisory comment as the human-friendly explanation.

**Files:** extras/check-inst-version-changes.sh (bot-committable); .github/workflows/ci.yml new job + check-ci.needs (NOT bot-committable — workflows-permission wall); source/slang/slang-ir.h:2260-2261 (constants).

**⚠️ Split delivery:** script change is bot-committable; the ci.yml portion must be posted as a maintainer-applied diff (assignee jkwak-work). See [[project_bot_workflows_permission]].

**State (07-19):**
- Triaged (verdict comment 5013932488 on issue) → forwarded to slang-fixer on canonical thread `gh-issue-shader-slang/slang-12157`.
- Fixer SHIPPED bot-committable part: `extras/check-inst-version-changes.sh` +27, opt-in enforce mode (`CHECK_ENFORCE=1`/`--enforce` → `::error::`+`exit 1` on needs-bump; default byte-identical, advisory comment flow untouched). 6 synthetic-git scenarios PASS; shfmt clean; codex PLAN/CODE/OUTPUT approve.
- ci.yml `check-ir-version-bump` job + `check-ci.needs` edit delivered as ready-to-apply **diff in PR body** (bot can't push workflow YAML).
- **Draft PR #12158** open, labeled `pr: non-breaking`. Peer review dispatched to slang-reviewer (verdict pending). Draft-CI = benign priority-yield (builds skipped), not a real failure.
- **Maintainer action required (jkwak-work):** apply the embedded ci.yml diff to make the check required.
- Chain: orchestrator → slang-triager → slang-fixer. Do NOT double-dispatch to fixer (triager owns the wired handoff). Awaiting reviewer verdict + maintainer application.
- Observability CONFIRMED (triager [Triage Resolution] verified PR independently): issue footprint LIVE — fixer posted draft-held 5-bullet (issue comment **5014066686**) on top of triage verdict (5013932488). Enforce mode fires AFTER advisory warning+artifact upload → `⚠️ IR Instruction Files Changed` comment byte-identical (avoids Approach-B pitfall). Only open observability item: fixer to confirm `report_pr_created(#12158)` (nudge msg out, in_reply_to=10).
- Chain stays OPEN until #12158 merges.
- **07-19 review round 1 (fixer msg 20):** slang-reviewer caught a **fail-OPEN** bug — enforcing gate could pass GREEN on a missing bump if merge-base absent from a shallow checkout (`git diff ... || echo ""` swallowed the failure). Fixer fixed to **fail-closed** (uncomputable diff → `::error::`+`exit 1`); advisory mode still byte-identical; ci.yml maintainer diff bumped to `fetch-depth: 0`; folded reviewer nit C001. 8 synthetic scenarios pass (2 new fail-closed); shfmt clean; codex re-approve. Re-pushed **HEAD 5e770366c5**. Awaiting reviewer's final combined verdict. Draft gate holds — no ready/merge.
- **07-19 jkwak-work @-mention (issue comment 5014083539)** — real bot mention, 3 Qs. ANSWERED by triager on-issue (comment **5014106406**, closest-to-the-state), verified via git:
  - Warning implemented by **PR #7821** "Add CI to check ir module versioning", author **@expipiplus1**, merged 2025-07-22, reviewed/merged by **@k3wlbuddy**. Advisory-by-design from the FIRST commit (`::warning::`+`exit 0` script + `on: workflow_run` poster both present initially; poster later renamed `comment-ir-version-check.yml`→`check-ir-version.yml` in #11828). Never flipped enforcing→passive.
  - Intent record is SILENT — #7821 has empty body, no linked issue, single-line commit, no review text. Told jkwak plainly (didn't invent intent).
  - Who to ask: @expipiplus1 (author, owns intent) primary; @k3wlbuddy secondary.
