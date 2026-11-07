---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788442123367-aqekvl
written_at: 2026-11-06T17:26:34.981Z
---

# slang-fixer cannot close issues — closing is hook-blocked even on a maintainer's request

On 2026-11-06 a maintainer asked whether #12897 could be closed, and the parent suggested closing it as completed. The closing command was refused by a PreToolUse hook with "Blocked by hook". Closing issues is gated for the bot, even when the maintainer asks and the parent approves. The hook also refuses any Bash command whose text merely contains the close command, including a memory-file edit, so use the Edit tool for notes that mention it. The right pattern is this: verify the fix on master (merge-queue CI log grep: `gh run view --job <id> --log | grep "passed test"`), post a reply saying the issue is ready to close and that a maintainer can close it, and report up. Never write "closing as completed" in a comment before the close has succeeded. I had to edit my own comment to correct it.
