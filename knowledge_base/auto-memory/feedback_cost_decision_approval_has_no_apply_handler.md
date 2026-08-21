---
name: feedback_cost_decision_approval_has_no_apply_handler
description: "Host defect measured 2026-08-21: a human-approved cost_decision approval no-ops — 'approved, but no handler is installed to apply it'. Row stays pending, no cost_decision handler in host src/. Every capped session's human decision silently drops. A raised group cap applies on NEXT spawn only, so it can't unblock a session already running under the old cap without a restart."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 2861fef4-d207-4f49-a66d-1fde7cb32722
---

# `cost_decision` approvals have no apply-handler — human decisions silently no-op

**Measured 2026-08-21.** `slang-fixer` session `sess-1787273918518-t41g0t` (shader-slang/slang
**#12668**, namespace-qualified attributes) hit its Tier-2 cost cap at ~01:49Z — spent **$34.76** vs
cap **$24.96**, episode `esc-sess-…-cap-0` — and escalated a `cost_decision` approval to
`dashboard-admin`. A human **approved** it (~02:31Z). The system then delivered to the fixer's
session:

> Your cost_decision was approved, but no handler is installed to apply it.

Confirmed: approval row `appr-1787276979555-s7lxav` is still **`pending`**, and
`grep -rniE 'cost_decision|costDecision' src/` on the host tree returns **nothing** — no
apply-handler is registered. So the approval is a no-op: the human said "continue" and nothing
continued. This will recur on **every** capped session until a handler is installed.

## Why the obvious workaround does not unblock a *running* session

`ncl cost-cap set --cap 60 --group slang-fixer` is **read at container spawn**, not live. I had set
that at 01:13Z; the stuck session started 00:58Z, so it runs under the old $24.96 cap regardless.
⇒ **raising the cap cannot retroactively unblock a session already running** — it needs a restart to
re-read, and `ncl groups restart` mid-fix **risks losing the in-progress worktree** (`wt-slang-12668`,
branch `fix/issue-12668`) before a PR is cut. So the two safe levers are: (a) a human/handler repairs
the approval so the existing session continues in place, or (b) accept a clean re-run from current
HEAD after restart. Neither is a silent-auto choice — escalated to operator (dashboard msg 69),
holding for the decision.

## The rule

- **A `cost_decision` "approved but no handler" notification is NOT informational — it means a human
  acted and the system dropped it.** OPS-critical (a human-in-the-loop step failing silently). Surface
  to the operator with the failing step + the pending row id + the affected session; do not let it
  pass as a heartbeat.
- **Before "just raise the cap", check the session's `created_at` vs the cap's write time.** A cap
  override only binds sessions spawned *after* it. A session already running under the old cap is
  unaffected until it respawns.
- **Do not `ncl groups restart` a fixer mid-fix to apply a cap** without weighing the worktree —
  uncut worktree state (no PR yet) is the thing at risk. `pr-mappings list | grep <issue>` tells you
  whether a PR exists to fall back to.

Cross-refs: cost-cap mechanism is `ncl cost-cap` (CLAUDE.md — runtime DB, read at spawn, not the
deprecated env var). Sibling OPS rule: never let a scheduled/credentialed human-gated step fail
silently.
