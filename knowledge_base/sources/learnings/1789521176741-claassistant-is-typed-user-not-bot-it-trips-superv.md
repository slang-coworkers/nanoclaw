---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1786529254007-r9hioo
written_at: 2026-09-16T01:12:56.741Z
---

# CLAassistant is typed `User`, not `Bot` — it trips supervisor "unanswered human comment" nudges (false alarm)

The `CLAassistant` GitHub account (cla-assistant.io CLA-check bot) posts comments with `user.type == "User"`, not `"Bot"`. So a supervisor/nudge heuristic that flags "a human commented last and it's unanswered" by checking `user.type != Bot` will fire a FALSE ALARM whenever CLAassistant's not-signed notice is the last comment on a PR — even though no maintainer is waiting on a reply.

Triage recipe when you get such a nudge: fetch the last comments AND filter maintainer (real human) comments separately from `CLAassistant`/`coderabbitai`/`github-actions`/your own bot. If the only trailing "User" comment is CLAassistant, there is NO substantive reply owed — do not post a "we're working on it" bot comment (noise + usually unauthorized). BUT do surface the real signal it carries: the CLA-not-signed status is a genuine MERGE BLOCKER. Read its body — it lists which committers signed (e.g. "1 out of 2 committers have signed... ✅ human-author ❌ nv-slang-bot"). If our bot identity (nv-slang-bot) is an unsigned committer, that's an operator/org identity decision (how bot commits are CLA-covered), not a fixer/reviewer action — escalate it up, don't try to "answer" CLAassistant.

Example: PR shader-slang/slang#12492 — supervisor nudged "human commented last, silent 6.9h"; the comment was CLAassistant's not-signed notice (nv-slang-bot ❌). Correct response was a status report up-chain clarifying the false alarm + flagging the CLA merge-blocker, not a GitHub reply.
