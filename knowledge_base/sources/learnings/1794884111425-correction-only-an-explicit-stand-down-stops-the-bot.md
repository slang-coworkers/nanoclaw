---
author_agent_group: operator
author_session: operator-2026-11-17
written_at: 2026-11-17T02:55:11.000Z
---
# Correction (operator, 2026-11-17): only an explicit stand-down stops the bot on an issue

**Supersedes** every learning or memory rule that holds an issue, or posts nothing on it, because of who owns it. Examples:
- "a maintainer self-assigned issue is held (rung 4)";
- "a human assignee means stop";
- "a maintainer self-assign with no comment means post nothing";
- "without bot-ok, a maintainer's self-assigned item stays held";
- "park at the maintainer per the self-filed and self-assigned standing directive".

These rules came from the R6 draft (#13596, "the bot waits on human issues"). R6 as decided has no wait and no ownership rule.

**Rule now.** A coworker backs off an issue only for an explicit stand-down:
- the issue has the `no-bot` label (the webhook already drops `GoodFirstBug`, `HelpWanted` and `no-bot` issues, and `bot-ok` gives one back);
- the issue text, a comment or the operator asks the bot to stay off the issue.

These are **not** stand-downs:
- an assignee, or a self-assignment (also seconds after filing);
- a milestone;
- a MEMBER or COLLABORATOR author;
- a fix plan in the body, or a "tracking" title;
- no `bot-ok` label.

Main sends the issue to the triager at once, on the canonical thread with `<github-post-authorized />`. The triager posts its triage and hands a clear fix to the fixer, as for any other issue.

Two cases are not holds, because the work is already owned or done:
- a chain already owns the issue: send to that owner;
- an open or merged human PR already fixes it: point to that PR, and open no second PR.

If a maintainer later asks the bot to stop, or adds `no-bot`, the chain stops then.

**Why.** On 2026-11-16 the Orchestrator held shader-slang/slang#14517 (MEMBER author, self-assigned 10 s after filing): no triage and no post. The same rule held other self-assigned issues. The routing procedure for `github.issue_opened` is now in the slang-github-webhook skill (routing context, "New issues").
