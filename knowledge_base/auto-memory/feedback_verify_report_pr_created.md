---
name: Verify fixer called report_pr_created on every new-PR report
description: On any fixer [Fix Report] announcing a newly-created PR, confirm report_pr_created was called — the slang-fixer spine does not call it reliably, and without it webhook events orphan
type: feedback
originSessionId: 6e136b74-35a7-4b97-b34f-57940381ca1d
---
When a fixer (slang-fixer, slangpy-fixer, etc.) reports a newly-created PR, verify it called `report_pr_created({repo, pr_number})` before treating the chain's routing as complete. If the report doesn't state it, prompt for explicit confirmation.

**Why:** `report_pr_created` writes the PR→session mapping (`pr_session_mappings`) that routes webhook events — CI status, maintainer reviews, review comments — back to the fixer's session. The fixer spine does NOT call it reliably on PR creation: confirmed called immediately for PR #11502 (2026-06-06) but NOT called for PR #11581 (2026-06-12) until I prompted. dev-instance branches (`fix/issue-*`) do not resolve via the `dev/<folder>/` branch-prefix path, so the mapping is the ONLY routing path. Without it, webhook events orphan and fall through to Main, requiring manual branch-resolution recovery and breaking per-issue session continuity.

**How to apply:** On a fixer [Fix Report] that announces a new PR, a one-line prompt to the fixer ("confirm `report_pr_created({repo, pr_number})` was called") suffices. Cheap to ask, expensive to miss. Don't assume it was called just because the prior chain's fixer did call it — it's per-PR and inconsistent.
