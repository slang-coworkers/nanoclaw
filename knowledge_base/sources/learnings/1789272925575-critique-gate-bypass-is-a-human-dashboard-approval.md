---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1787145227836-eow42g
written_at: 2026-09-13T04:15:25.575Z
---

# Critique-gate bypass is a human dashboard approval, not an orchestrator action; draft-PR is the release valve for a gate-blocked fix

Distilled from supervising shader-slang/slang#12622 (NVRTC `-pch`), which stalled ~13 days on a fixer's critique gate. Three reusable facts for any orchestrator/triager driving a fix chain through the critique-gate overlay:

## 1. The critique-gate bypass grant is a HUMAN admin approval — the orchestrator cannot apply it
When a gated fixer's codex critique gate hard-blocks `gh pr create` (PreToolUse), the graduated escalation is **deny ×3 → human approval**. On the 3rd denial the host auto-creates a `critique_gate_bypass` row in `pending_approvals`, routed to `dashboard-admin` with Approve/Reject/Reject-with-reason options (title like *"Critique gate — gh-issue-<owner>/<repo>-<n>: critique returned must-fix"*).

- **`ncl approvals` is list/get ONLY** — there is no approve verb. The orchestrator (even global scope) CANNOT flip the grant. This is by design: it's the human guardrail.
- The grant is applied only when a **human admin clicks Approve on the dashboard card**; the host-sweep + `src/modules/critique-escalation/` then writes the grant (`critique_gate_bypass_approved=true` + grant_id/expiry) and the fixer's gate opens on its own, firing `gh pr create` automatically.
- **Orchestrator's actual job:** locate the live card (`ncl approvals list`, match `action=critique_gate_bypass` + the issue thread), and hand the operator the exact `approval_id` + a one-click Approve/Reject recommendation. Do NOT tell a downstream fixer/triager "proceed now, don't wait on the operator" — the fixer is hard-blocked until the human clicks; there is no orchestrator-side apply. (I made exactly that wrong call and had to retract it.)
- Reject is a first-class outcome: on #12622 the admin **rejected** the bypass, and the fixer's pre-agreed decision tree took the clean path (build the test first, open gate-clean). The gate worked end-to-end.

## 2. Anti-pattern: a fixer blocked on its own gate that silently "stands by" for days
#12622's fixer built the fix, hit its critique gate on PR creation, and then repeatedly reported *"standing by"* for ~13 days without either opening a draft-held PR or escalating the decision. It took the **reporter asking "where's the PR"** to unstick it. Rule: a fixer blocked on its critique gate must **open a draft-held PR OR escalate the decision promptly** — never silently idle. Supervisor heuristic to catch it: *pushed branch + no PR + age > N days* → nudge/escalate.

## 3. A draft PR is the safe release valve — but it SKIPS CI
Opening a **draft** PR ships nothing: GitHub won't auto-merge a draft and `Fixes #<n>` won't auto-close from one, and the gate still re-blocks the ready-for-review flip until the required test lands. So a draft is the correct way to give a waiting reporter a visible artifact without weakening the merge-quality bar. **Gotcha:** `ci.yml` filters `draft != true`, so behavioral CI asserts (e.g. the CUDA-13 tier here) do NOT run while the PR is draft — they execute only when a human flips it to ready-for-review. Don't treat a green-looking draft as CI-verified.

Verdict on #12622: FIXED gate-clean via path B (draft #12880, reviewed APPROVE_WITH_NITS, `Fixes #12622`, held for human merge). The rejected-bypass → clean-path-B outcome was arguably better than the draft-then-follow-up path — the PR landed fully clean with the test included, no exception on record.
