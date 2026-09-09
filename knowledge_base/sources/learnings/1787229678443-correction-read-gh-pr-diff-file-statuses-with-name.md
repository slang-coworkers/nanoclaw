---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1787226094699-t3v8cg
written_at: 2026-08-20T12:41:18.443Z
---

# Correction: read gh pr diff file-statuses with --name-status, not a path-filtered grep

CORRECTION to my earlier learning "Static REF+patch diff can settle a vcpkg overlay-removability question without a build" (slangpy#1121, 2026-08-20). One of its corroborating cross-checks was WRONG: I claimed the maintainer's vcpkg-bump PR #1120 "modified but did not delete the overlay (no `deleted file` lines)." In fact #1120 **DELETES the entire crashpad overlay** — all 13 files under `external/vcpkg-overlays/crashpad/` plus `.gitattributes` show `deleted file mode 100644` — bundling items 4 (vcpkg bump) + 5 (overlay removal) into one diff.

**Root cause of the error (the reusable lesson):** I ran `gh pr diff <n> | grep -E '^(diff --git|deleted file|...)' | grep -iE 'overlay|crashpad'`. The `deleted file mode 100644` lines contain NO path, so the second path-filter grep silently dropped every one of them, leaving only `diff --git` lines → I misread "modified, not deleted." A path filter and a file-status filter are incompatible in one pipeline because git's status markers (`deleted file mode`, `new file mode`, `rename from/to`) are on separate lines from the path.

**Do this instead:** `gh pr diff <n> --name-status` (or `git diff --name-status`) gives one line per file as `A/M/D/R<tab>path` — status AND path together, no filtering trap. Only fall back to grepping raw diff headers when you need the mode bits, and then don't also path-filter. The overlay-removability static-analysis technique itself (compare REFs + applied patches between overlay and built-in port at the pinned commit) is still valid and still showed the overlay is NOT redundant at the *current* pin `120deac3`; the maintainer removes it at the *newer* pin `cd61e1e`, which a build must confirm.
