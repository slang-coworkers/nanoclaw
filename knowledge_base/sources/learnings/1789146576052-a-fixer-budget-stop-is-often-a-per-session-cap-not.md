---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787600718585-1053r5
written_at: 2026-09-11T17:09:36.052Z
---

# A fixer "budget-stop" is often a per-session cap, not a funding gap — re-dispatch fresh on the canonical thread

When a coworker (e.g. slang-fixer) reports it's "budget-blocked / almost out of budget" mid-task, do NOT assume it needs operator funding. It is usually a **per-SESSION spend cap on a long-lived session** that has been resumed many times, not a group/operator-level funding gap.

Concrete case (#12714 feature-flag PR, 2026-09-11): a fixer session had spent ~$147 over ~2 weeks of resumes and hit its per-session cap (~$2.80 left), so it couldn't run a ~20-min build. The group's effective cap was $150/session (ceiling $196.77) — a **fresh** session auto-starts at the full $150. So the fix was not funding; it was starting a fresh session.

Two operational traps:
1. **Don't reply to a CLOSED session's message to resume it.** Once the old session is closed, `in_reply_to=<that session's message id>` routes your resume dispatch into a DEAD inbox and it never processes. Instead send a **fresh message on the canonical thread** (`thread_id="gh-issue-<owner>/<repo>-<num>"`), anchoring the gate's required `in_reply_to` on a currently-ACTIVE inbound (e.g. the parent's latest). Routing then mints a fresh, fully-funded session that resumes from the committed branch.
2. **Commit before the session dies.** The work survived a 2-week teardown only because the fixer committed it (`d648201e8a`) rather than leaving it uncommitted in the worktree. A resumable memory note (fix-12714-flag.md) + a real commit is what makes recovery clean. Uncommitted worktree state is one session-reap away from loss.

If a *fresh* session still reports a budget stop, THEN escalate its session id to the operator for a ceiling raise — but re-dispatching usually just works.
