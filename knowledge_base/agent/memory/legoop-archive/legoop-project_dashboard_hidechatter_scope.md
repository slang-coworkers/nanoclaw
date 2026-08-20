---
type: project
title: "The"
description: "ported lego-operator-memory archive; project note"
tags: [legoop-archive, ported]
---

# The

**Bug (PR #550, fixed by #553):** the dashboard `/api/messages` main view showed **0 outgoing messages** on both lego and prod — a `/supervise-issues` reply was generated + delivered but never displayed.

**Root cause:** #550 declared `const hideChatterSql` **inside** the inbound `if (existsSync(inDbPath))` block but referenced it in the separate outbound `if (existsSync(outDbPath))` block. The outbound query threw `ReferenceError: hideChatterSql is not defined`, which the enclosing per-session `catch { /* session DB may not exist or be locked */ }` (dashboard/server.ts ~6145) **silently swallowed** → every session's outbound rows dropped.

**Why it slipped through:** `dashboard/server.test.ts` can't run standalone on nv-dashboard (it imports `../src/modules/approvals/decision.js`, nv-main-only — [[project_nv_branch_cross_imports]]), so #550 was "verified" by build+functional-sim only, never by executing the test. The bug only surfaced once `/update-nanoclaw-instance` composed the tree and `npm test` (whose include nv-main expanded to `dashboard/**`) actually ran it.

**Fix (#553):**
1. Hoist `hideChatterSql` to per-session scope (before the `for (const sess of sessions)` body's inbound block) so both query blocks see it.
2. Gate on `!threadMode && !includeSystem` (NOT just `!includeSystem`) — the thread/debug view must still surface claudemd-refresh/plumbing rows (an existing thread-plumbing test caught this).

**Lessons:**
- A `catch {}` that swallows without logging hid a hard ReferenceError for hours. When outbound "silently produces nothing," instrument the swallowing catch first (`console.log` the error) — that found it in one shot.
- Don't trust build+sim for dashboard changes — the real signal is the composed-tree `npm test`. nv-dashboard standalone can't run its own server.test.ts.
- Debugging tip: gate debug logs on a real condition, not a hardcoded session id (a hardcode that never matches teaches nothing). Use the app's stdout (dashboard logs → nanoclaw-dashboard.log); `server.ts` has no `log` import — use `console.log`.

Verified live: lego main view → 13–18 outgoing restored. Prod still had broken #550 at fix time → [[[see task]]] flagged for the prod-owning agent. Related: [[project_nv_dashboard_base_file_conflict]] (#552, the other update-surfaced bug).

