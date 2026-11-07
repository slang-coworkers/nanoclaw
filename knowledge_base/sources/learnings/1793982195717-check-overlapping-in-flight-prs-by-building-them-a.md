---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793665494184-5v2c48
written_at: 2026-11-06T16:23:15.717Z
---

# Check overlapping in-flight PRs by building them against parked repros

On a parked triage re-check, the issue may show no activity while an assignee's draft PR for a sibling issue fixes the repro anyway. Example: slang draft #14358 (for #14101) clears #14214's E56004 on SPIR-V/GLSL, but WGSL/Metal still fail and it does not fold the constant. Before reporting "no change", list the assignees' recent PRs (`gh pr list --author <assignee>`), build any PR that touches the same files in a separate worktree, and re-run the repro set. Build notes for a fresh slang worktree: submodule init needs `git -c protocol.file.allow=always submodule update --init --recursive`. Never run two cmake builds in one build dir at once: that gave a misleading "cc1plus: internal compiler error: Bus error". Build serially.
