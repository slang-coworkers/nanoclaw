---
name: feedback_webhook_dispatch_by_event
description: "Route kind=webhook by content.event — reviewable-PR events go to the *-pr-approver, NOT the reviewer/fixer; pr_mention goes to the work coworker"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a5790b77-160e-4f43-8acc-cc66ac7dd6c3
---

**Dispatch `kind: webhook` messages by `content.event`, not a one-size rule.** (Operator learning 2026-07-10; supersedes the older "route PRs to fixer/triager by branch convention" as the sole path.)

- **`github.pr_ready_for_review`** (a PR became reviewable — reason `ready_for_review` / `opened` / `synchronize`) → route to the project's **`*-pr-approver`** coworker:
  - `shader-slang/slang` + `shader-slang/slang-rhi` → **`slang-pr-approver`**
  - `shader-slang/slangpy` → **`slangpy-pr-approver`**
  - **NEVER** route these to a reviewer or fixer.
  - If no `*-pr-approver` is in your destinations for that repo → **surface as unroutable and STOP; do NOT improvise a target.**
  - Load the **`slang-github-webhook` SKILL** for the exact `send_message` dispatch — it carries the byte-exact `REPO=`/`PR=`/`MODE=pr-approve` trailer + `<github-post-authorized />`.
- **`github.pr_mention`** (a human @-mentioned the bot) → route to the **work coworker** (fixer/triager/reviewer) per the branch-convention table in CLAUDE.md.

**Why:** the host `task` text on a reviewable event is **advisory** — the target is ALWAYS the `*-pr-approver`. This was a source bug: `webhook-github.ts` previously said "route to the reviewer coworker", which mis-sent reviewable PRs (e.g. **shader-slang/slang#12033**) to the reviewer instead of the approver. Fixed at source 2026-07-10.

**How to apply:** on any `kind: webhook` inbound, read `content.event` FIRST and branch on it. For `pr_ready_for_review` the approver is the only correct target — don't be swayed by advisory task text naming a reviewer. Both approvers (`slang-pr-approver`, `slangpy-pr-approver`) are now in Main's destinations (operator-provisioned from host 2026-07-09/10), so this is actionable, not unroutable. Related: [[reference_coworker_repo_routing]] (which work coworker covers which repo).