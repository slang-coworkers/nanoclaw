---
name: project_nanoclaw_pr875_approver_mounted_policy
description: "slang-coworkers/nanoclaw#875 bot-authored slang-pr-approver mounted-policy fallback — reviewed inline LGTM, maintainer owns merge (nv-slang)"
metadata:
  node_type: memory
  type: project
  originSessionId: pr875-webhook
---

**slang-coworkers/nanoclaw#875** — `feat(slang-pr-approver): mounted-policy fallback for shadow relaxation`, branch `fix/haaggarwal/slang-approver-mounted-policy` → **`nv-slang`** (protected). **Bot-authored** (`nv-slang-bot[bot]` + `claude`). `pr_ready_for_review` webhook fired 2026-07-10 (opened, then `synchronize`).

**Now 2 commits, 2 files, +57/−15** (grew from the original 1-file/+15−2 via a `synchronize`):
- `c1d8e1b5` (new) — `SKILL.md`: rewrites Step-3 challenger into a real investigation ("reviewer's doc is your prior, not your verdict") + adds `pr_merged`/`pr_closed` terminal-PR calibration bullet (`record_human_verdict` + one abstract `append_learning`, nothing posts). **Re-reviewed OK: all safety invariants preserved/tightened** — any-doubt⇒ABSTAIN, can't-check⇒ABSTAIN, "investigation can only add caution, never upgrade a 🔴/gap toward approval," deepwiki-unreachable-never-upgrades kept. "As much/little as change warrants" = effort allocation, NOT a lower abstain bar.
- `2e0be93` — `eval-clauses.py` mounted-policy fallback (below); byte-identical to first review.

**Handled inline by Main — NOT routed.** Same repo-class as [[project_nanoclaw_pr864_sync_blocked]] / #868 / [[project_nanoclaw_pr871_funnel_cron]] / [[project_nanoclaw_pr873_sync_nvmain]]: platform-infra fork, NOT in the product-coworker routing map, and **no `nanoclaw-reviewer` wired** (only product-scoped `slang-reviewer`/`slangpy-reviewer` — wrong domain for approver-skill code). Generic host "route to reviewer" text is overridden — no valid reviewer destination exists.

**Change:** `container/skills/slang-pr-approver/scripts/eval-clauses.py` — inserts a 3rd tier into policy resolution: `--policy` → per-PR staged (`<ws>/policy/APPROVAL_POLICY.json`) → **NEW group-mounted (`/workspace/extra/approver-policy/APPROVAL_POLICY.json`)** → bundled v0 default. Lets shadow-mode clauses be relaxed via a per-group `additional_mount` without editing the bundled #834 default (used for historical scoring).

**`eval-clauses.py` change:** `if per_pr / elif MOUNTED_POLICY / else DEFAULT` preserves precedence correctly (explicit `--policy` still wins via outer `if not policy_path`; per-PR staged still beats the mount; bundled #834 v0 default remains final fallback).

**Review verdict: LGTM across BOTH commits.** CI: commit-1 head was green (`ci`✓ `label`✓); **CI re-running/pending on new head `c1d8e1b5`** after the doc-only add (`mergeStateStatus: UNSTABLE`). `reviewDecision` empty — no formal GH review required on this fork. **Edited the existing LGTM comment in place** (comment hygiene — bot was last commenter, synchronize is a push not a thread reply) to cover both commits: https://github.com/slang-coworkers/nanoclaw/pull/875#issuecomment-4932713237

**Merge is the maintainer's** — targets protected `nv-slang`, OUTSIDE the standing `nv-coworkers`-scoped auto-merge authority [[feedback_nv_coworkers_automerge]] (that grant covers `nv-coworkers` only, not `nv-slang`). On redelivery: if head is still `c1d8e1b5`, state unchanged — do NOT route to product reviewers, do NOT re-review, do NOT merge. Only re-review if a further `synchronize` pushes a NEW head SHA.
