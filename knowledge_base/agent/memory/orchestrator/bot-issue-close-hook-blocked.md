---
type: rule
description: A PreToolUse hook blocks the bot from closing GitHub issues (even mentioning the command). Leave closing to the maintainer, and never suggest that a coworker close one.
tags: [github, hooks, dispatch]
---

# The bot cannot close GitHub issues

A PreToolUse hook blocks `gh issue close` for this bot, in coworkers and in Main. The hook
matches the text of the command, so a Bash call that only *greps* for that string is
blocked too (Main, 2026-11-06).

**Rule:** when a maintainer asks "can we close this issue?", the coworker checks the fix and
replies on the issue that it is ready to close. The maintainer does the close. Do not put
"close it if the check passes" in a dispatch, and do not work around the hook (with the API,
another tool, or an operator ask for a single issue). The gate is there on purpose.

**Case:** #12897 (2026-11-06). jkwak-work asked if the issue could close after PR #12899
merged. The issue stayed OPEN because the auto-close from `Closes #12897` did not fire. My
dispatch suggested closing it, so slang-fixer tried once and the hook blocked it. The
fixer then edited its reply to say a maintainer can close the issue (comment 6691050832).
The cost was one blocked attempt.

Also from that case: check issue numbers that you copy from an old fix report. The Sep-3
report gave "deferred to #12161/#12051", but #12051 has nothing to do with the nonuniform
work. The fixer corrected this.
