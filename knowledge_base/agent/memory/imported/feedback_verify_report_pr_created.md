---
name: Verify fixer called report_pr_created on every new-PR report
description: On any fixer [Fix Report] announcing a newly-created PR, confirm report_pr_created was called — the slang-fixer spine does not call it reliably, and without it webhook events orphan
type: feedback
originSessionId: 6e136b74-35a7-4b97-b34f-57940381ca1d
---
When a fixer (slang-fixer, slangpy-fixer, etc.) reports a newly-created PR, verify it called `report_pr_created({repo, pr_number})` before treating the chain's routing as complete. If the report doesn't state it, prompt for explicit confirmation.

**Why:** `report_pr_created` writes the PR→session mapping (`pr_session_mappings`) that routes webhook events — CI status, maintainer reviews, review comments — back to the fixer's session. The fixer spine does NOT call it reliably on PR creation: confirmed called immediately for PR #11502 (2026-06-06) but NOT called for PR #11581 (2026-06-12) until I prompted. dev-instance branches (`fix/issue-*`) do not resolve via the `dev/<folder>/` branch-prefix path, so the mapping is the ONLY routing path. Without it, webhook events orphan and fall through to Main, requiring manual branch-resolution recovery and breaking per-issue session continuity.

**How to apply:** On a fixer [Fix Report] that announces a new PR, a one-line prompt to the fixer ("confirm `report_pr_created({repo, pr_number})` was called") suffices. Cheap to ask, expensive to miss. Don't assume it was called just because the prior chain's fixer did call it — it's per-PR and inconsistent.

**Orphaned-PR claim remedy (2026-06-30, #11845/PR #11849):** When a fixer stands down on an issue because "a parallel session already shipped PR #N", verify that PR #N has a *confirmable live owner* before accepting the stand-down — otherwise it orphans. Diagnostic signals of a lost/phantom original driver: the reporting session only observed the PR via `gh pr view` (didn't author it), can't read the PR→session map, AND its MEMORY.md index references a detail file (e.g. `fix-NNNNN.md`) that does NOT exist on disk (dangling pointer = the building session was lost/wiped/forked-away). Remedy: have the live, idle fixer that holds the triage context call `report_pr_created({repo, pr_number})` to claim routing. Safe because the PR's coding is already done — no work collision, only routing consolidation onto a known-live session. Do NOT claim if the parallel session is confirmed live AND holds the build context (that would steal context); only claim when no live owner can be confirmed.
