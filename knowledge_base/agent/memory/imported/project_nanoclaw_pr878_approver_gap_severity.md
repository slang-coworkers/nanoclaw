---
name: project_nanoclaw_pr878_approver_gap_severity
description: "slang-coworkers/nanoclaw#878 bot-authored slang-pr-approver gap-severity + TodoWrite + dispatch-clarity — reviewed inline LGTM, maintainer owns merge (nv-slang)"
metadata:
  node_type: memory
  type: project
  originSessionId: pr878-webhook
---

**slang-coworkers/nanoclaw#878** — `feat(slang-pr-approver): gap-severity judgment + TodoWrite anchor + dispatch clarity`, branch `fix/haaggarwal/slang-approver-gap-severity` → **`nv-slang`** (protected). **Bot-authored** (`nv-slang-bot[bot]` + `claude`). `pr_ready_for_review` webhook fired 2026-07-10 (opened). Head `2227a3da`. 2 files, SKILL.md + WORKFLOW.md, all skill/workflow **prose only** (no code).

**Handled inline by Main — NOT routed.** Same repo-class as [[project_nanoclaw_pr875_approver_mounted_policy]] / [[project_nanoclaw_pr874_webhook_route_approver]] / #864 / #868 / #871 / #873 / #876 / #877: coworker platform-infra fork, NOT in the product-coworker routing map ([[feedback_webhook_dispatch_by_event]] maps by *repo* — only `shader-slang/slang|slang-rhi|slangpy`). No `nanoclaw-reviewer` wired; `slang-pr-approver` reviews *compiler* PRs, not its own skill prose — routing there would be a category error. Advisory task text ("route to *-pr-approver") overridden.

**4 changes (from PR body + verified diff):**
1. **Gap-severity (only behavioral change).** A single non-pre-existing 🟡 gap was Step-2 auto-ABSTAIN; now passed forward and judged by severity in Step 3 (conservative-lean). Clears only if clearly inconsequential (unreachable trigger / covered elsewhere / pure future-proofing); else ABSTAIN `OPEN_GAP` on any plausible trigger/blast-radius/purpose-undermining. **Rails preserved & verified:** 🔴⇒BLOCK kept; "never upgrade a 🔴" kept; harness-integrity fails ⇒ ABSTAIN+short-circuit kept (tighter); **Uncertainty⇒ABSTAIN** stated twice; per-gap recording required (auditability). Approver is **shadow-only** (DECISION never posts/merges) so over-lenient clearance only skews agreement scoring, can't cause unsafe merge — bounds the risk.
2. TodoWrite lifecycle anchor (stage→dispatch→await→decide→record).
3. SKILL opening dispatch-clarity: disambiguates "never review code" from "never dispatch reviewer" (Step 1b send_message is required).
4. WORKFLOW synchronize-debounce: settle head, one review per settled revision (one-decision-per-revision/STALE_STAGE guard unchanged).

**Verdict: LGTM.** CI green (`ci`✓ `label`✓ on head `2227a3d`); not draft; `reviewDecision` empty (no formal GH review on this fork). Posted LGTM via **REST** (`gh pr comment` GraphQL blocked "Resource not accessible by integration"; REST `issues/{n}/comments` works — same as #871/#875): https://github.com/slang-coworkers/nanoclaw/pull/878#issuecomment-4934965548

**Merge is the maintainer's** — targets protected `nv-slang`, OUTSIDE `nv-coworkers`-scoped auto-merge grant ([[feedback_nv_coworkers_automerge]]). On redelivery: if head still `2227a3da`, state unchanged — do NOT route to product reviewers, do NOT re-review, do NOT merge. Only re-review on a NEW head SHA via `synchronize`.
