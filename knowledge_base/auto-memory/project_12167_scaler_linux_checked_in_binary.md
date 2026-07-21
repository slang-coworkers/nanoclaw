---
name: project_12167_scaler_linux_checked_in_binary
description: "#12167 remove checked-in scaler-linux binary — draft PR #12168 reviewed CLEAN, held for operator merge"
metadata: 
  node_type: memory
  type: project
  originSessionId: 3a15d888-fade-4c0a-90c6-b0098da5e6d1
---

# #12167 — Generated `scaler-linux` binary checked into Git

Reporter pdeayton-nv (CONTRIBUTOR). `extras/scaler/scaler-linux` = 34.65 MB ELF tracked in Git; Go source + build docs in-repo. Repo-hygiene chore, not a compiler defect. Class: enhancement / low / CI-build-infra / **P3**.

**Chain (all on canonical thread `gh-issue-shader-slang/slang-12167`):**
- Triage VERIFIED at master HEAD 6a244fee2; `reproduced` label; removal SAFE — nothing consumes the tracked copy. Verdict posted, then **refreshed in place → live issue comment 5028972481** ("fix in draft PR #12168, held pending review"); earlier dup bot comment consolidated to one (edit-in-place hygiene).
- Fixer → draft PR **#12168**, branch `fix/issue-12167`, commit b2dd0d21, `report_pr_created` done. 2-line net diff: `git rm --cached extras/scaler/scaler-linux` + `.gitignore` `/extras/scaler/scaler-linux`. `Closes #12167`. Working-tree copy preserved; still reproducible via `go build -o scaler-linux ./cmd/scaler`.
- Reviewer (slang-reviewer, correctness) → **✅ APPROVE, CLEAN**. Full-repo sweep confirmed no consumer reads tracked/index copy: deploy scripts build-or-fail from working tree, `.service` units use deployed VM path, README documents build, `.github/workflows` only prose, no CMake/packaging ref. `git show|cat-file|checkout|archive|ls-files` on scaler = zero matches.

**Reviewer 404 false alarm (07-21):** slang-reviewer's unauth check reported "PR #12168 does not resolve" (~30s after creation, 00:54:36Z). Verified via **authenticated MCP get_pull_request** = real, open, draft, `Closes #12167`, head `fix/issue-12167`→master. Cause = GitHub replication/cache window on an unauth probe. Lesson reinforced: [[feedback_never_relay_a_verdict_not_in_hand]] — verify PR existence at claim-precision with an authed call before propagating a "missing PR" blocker.

**Reviewer token block:** reviewer container saw `GH_TOKEN=placeholder` (OneCLI gateway per-request injection pattern; `gh` reads literal env). Isolated — fixer's writes (PR create + set assignees/reviewers/labels) all succeeded, so App token works. Shadow APPROVE held (file + this memo); not posted — draft PR, human reviewers already requested, production review bot runs on ready. Not a systemic outage; see [[feedback_gh_auth_status_misleading]], [[feedback_push_not_away]].

**Fix Report in hand (07-21):** fixer confirmed commit b2dd0d21, Approach A verbatim, 5-bullet footprint on issue. Peer-reviewed APPROVE + fixer's own codex PLAN/CODE/OUTPUT all APPROVE. The **single red CI run is the expected draft priority-yield** (only `wait-for-human-priority`+`check-ci` "fail", 33 builds skipped, auto-reruns) — benign, matches [[project_bot_pr_priority_yield_red_run]]; do NOT misread as a real failure. Approach B (ignore sibling `scaler`/`scaler-windows` outputs) noted in PR body as follow-up only, not implemented.

**State:** draft-held pending human review/merge (drafts-only guardrail — no operator ready/merge authorization yet). Human reviewers jkwak-work + jkiviluoto-nv requested on PR. History rewrite explicitly out of scope — untracking stops future bloat only. **Chain COMPLETE at healthy terminal draft-hold** — triage→fix→review all done, all reports in hand. See [[feedback_drafts_only_guardrail]], [[feedback_github_writes_operator_authorized]], [[feedback_holding_echoes_are_noise]].
