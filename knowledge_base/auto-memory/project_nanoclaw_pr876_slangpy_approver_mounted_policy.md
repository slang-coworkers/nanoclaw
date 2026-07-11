---
name: project_nanoclaw_pr876_slangpy_approver_mounted_policy
description: "slang-coworkers/nanoclaw#876 bot-authored slangpy-pr-approver mounted-policy fallback + SKILL.md rewrite — reviewed inline LGTM+1 nit, maintainer owns merge (nv-slangpy)"
metadata:
  node_type: memory
  type: project
  originSessionId: pr876-webhook
---

**slang-coworkers/nanoclaw#876** — `feat(slangpy-pr-approver): mounted-policy fallback for shadow relaxation`, branch `fix/haaggarwal/slangpy-approver-mounted-policy` → **`nv-slangpy`** (protected). **Bot-authored** (`nv-slang-bot[bot]`). Twin of [[project_nanoclaw_pr875_approver_mounted_policy]]. `pr_ready_for_review` (synchronize) webhook fired 2026-07-10 with task "route to reviewer coworker."

**Handled inline by Main — NOT routed.** Same repo-class as [[project_nanoclaw_pr875_approver_mounted_policy]] / [[project_nanoclaw_pr873_sync_nvmain]] / [[project_nanoclaw_pr871_funnel_cron]] / [[project_nanoclaw_pr864_sync_blocked]]: platform-infra fork, NOT in product-coworker routing map, **no `nanoclaw-reviewer` wired** (only product-scoped `slang-reviewer`/`slangpy-reviewer` — wrong domain for approver-skill code). Generic host "route to reviewer" overridden — no valid reviewer destination.

**NOT byte-identical to #875 despite body claim.** #875 was 1 file (`eval-clauses.py`). #876 carries TWO files:
1. `scripts/eval-clauses.py` — 3-tier policy resolution (`--policy` → per-PR `<ws>/policy/APPROVAL_POLICY.json` → **NEW group-mounted `/workspace/extra/approver-policy/APPROVAL_POLICY.json`** → bundled v0 default). Byte-identical to #875's change. Precedence preserved correctly.
2. `SKILL.md` (NEW, #875 lacked this) — (a) Step 3 challenger rewritten "challenger → investigate & reconcile"; guardrails survive (any-doubt⇒ABSTAIN, "investigation can only add caution, never upgrade a doc's 🔴 toward approval", deepwiki-unreachable-never-blocks); (b) new `pr_merged`/`pr_closed` calibration handler → `record_human_verdict` + `append_learning`, nothing posts to GitHub.

**Review verdict: LGTM + 1 non-blocking nit.** Nit: `closed-unmerged ⇒ CHANGES_REQUESTED/REJECTED-equivalent` mapping treats every unmerged close as a negative verdict — PRs also close for supersede/dup/obsolete/abandon; could add calibration noise. Suggested gating negative verdict on actual change-request signal. Minor, not a blocker. CI `ci` pending at review (`UNSTABLE` only b/c ci pending; `mergeable: MERGEABLE`; `reviewDecision` empty — no formal GH review required on this fork).

Posted via REST (GraphQL `gh pr comment` blocked "Resource not accessible by integration"; REST issues/comments works — see [[project_nanoclaw_pr871_funnel_cron]]): https://github.com/slang-coworkers/nanoclaw/pull/876#issuecomment-4932987047

**Merge is the maintainer's** — targets protected `nv-slangpy`, OUTSIDE standing `nv-coworkers` auto-merge authority [[feedback_nv_coworkers_automerge]] (covers `nv-coworkers` only). On redelivery: state unchanged; do NOT route to product reviewers, do NOT re-review, do NOT merge.
