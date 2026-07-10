---
name: project_nanoclaw_pr864_sync_blocked
description: "slang-coworkers/nanoclaw#864 upstream-sync PR blocked — real CI break, no reviewer wired, bot has no write on that repo"
metadata: 
  node_type: memory
  type: project
  originSessionId: 2d0c988a-0d85-431e-99e1-189123b36961
---

**slang-coworkers/nanoclaw#864** — bot-authored `sync-upstream.sh` PR (`sync/upstream-nv-dashboard` → `nv-dashboard`), 48 files +2378/−710. Webhook `pr_ready_for_review` fired repeatedly (2026-07-10).

BLOCKED on three fronts, no autonomous action available:
- **CI red = REAL build break, not flake.** `pnpm run build` (tsc) fails: `insertTask` renamed to `insertTaskRow` upstream (ncl-tasks refactor `b0c76ce4c`) but fork's `src/modules/scheduling/actions.ts:17` + `db.test.ts` (315,334) + `behavioral-harness.test.ts:49` still reference old name; `shouldCloseTaskSession` no longer exported from `host-sweep.js` (`host-sweep.test.ts:16`). Incomplete merge integration — human must reconcile.
- **No `nanoclaw-reviewer` coworker wired.** Only `slang-reviewer` / `slangpy-reviewer` exist, both product-scoped. Can't route platform code there.
- **Bot lacks GitHub write on `slang-coworkers/nanoclaw`.** `gh pr comment` → `Resource not accessible by integration (addComment)`. Distinct from shader-slang/slang where writes work ([[project_nv_slang_bot_readonly_incident]]). This is a direct write failure on the fork-org repo, not a misleading probe.

**Next:** awaiting operator decision (spawn nanoclaw-reviewer / review inline / hold for human merge-fix). Merge is operator-gated regardless. On redelivery: do NOT re-derive — state unchanged until CI goes green or operator answers. Related: [[feedback_push_not_away]] (timeout ≠ absent).

---

**UPDATE 2026-07-10 — sibling PR #868 (nv-main sync) MERGED, no action.** Parallel sync PR `sync/upstream-nv-main` → `nv-main` (upstream `0c0f4c25`, 48 files +2361/−906). This one FIXED the `insertTask→insertTaskRow` break that blocked #864: its body reconciled the ncl-tasks control-plane conflict, CI went **green** (`check`+`ci` pass, head `312141ac`), and `nv-slang-bot` **self-merged** it into `nv-main` at 2026-07-09T21:46:03Z (commit `f68f7844`), ~5 min after opening — within standing fork auto-merge authority [[feedback_nv_coworkers_automerge]]. The `pr_ready_for_review` webhook for #868 is **stale on redelivery**: PR is terminal (merged), nothing to route, and still no `nanoclaw-reviewer` wired. Do NOT route a merged platform-sync PR to product-scoped reviewers. #864 (nv-dashboard branch) remains OPEN/blocked separately — its branch may still carry the same CI break; leave as-is unless operator asks.
