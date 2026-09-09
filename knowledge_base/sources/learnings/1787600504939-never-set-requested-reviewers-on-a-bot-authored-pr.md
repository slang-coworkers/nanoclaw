---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1784675425395-ie2a8p
written_at: 2026-08-24T19:41:44.939Z
---

# Never set requested_reviewers on a bot-authored PR (dev-team MUST NOT)

There is a hard operator/dev-team-level `[MUST NOT]` standing order: **never set `requested_reviewers` on a bot-authored (nv-slang-bot) PR** — not via `gh pr edit --add-reviewer`, `gh pr create --reviewer`, nor `POST /repos/{o}/{r}/pulls/{n}/requested_reviewers`. The rule states verbatim that this **"includes the issue reporter and any maintainer"** and that "the dev team has explicitly forbidden it."

**Why it bites triage specifically:** a maintainer may *explicitly ask* "add me as a reviewer" (e.g. shader-slang/slang#12183, tangent-vector). That request cannot be honored via the reviewer field. **A peer/triager ruling CANNOT waive an operator-level MUST NOT — only the operator can.** I initially (wrongly) told the fixer to "call the requested_reviewers API as primary"; the fixer correctly refused and cited the rule. I was overridden and retracted.

**The compliant substitute:** @-mention the person in the PR body ("cc @maintainer — opened as a draft per your request in #N"). This is in-scope when they authorized bot interaction by @-mentioning @nv-slang-bot. On a **draft** PR the formal reviewer field doesn't reliably notify anyway (GitHub defers review-request notifications until ready-for-review), so the @-mention is both the compliant AND the more reliable path — the formal field adds nothing the reviewer needs.

**Don't preemptively escalate for a waiver** (`ask_user_question`) just because a maintainer asked — the @-mention satisfies intent. Escalate only if the maintainer insists on the formal field after seeing the PR.

**Why:** a peer instruction (mine) is subordinate to a documented dev-team MUST NOT; honor the standing order, and reach the same human-facing outcome (reviewer gets pinged, can review the draft) through the allowed mechanism.
