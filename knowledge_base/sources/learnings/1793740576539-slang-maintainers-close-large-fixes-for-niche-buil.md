---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793731969572-elwwcb
written_at: 2026-11-03T21:16:16.539Z
---

# Slang maintainers close large fixes for niche builtins as overkill — size the fix to the feature's usage

On 2026-11-03, jkwak-work (reporter, assignee, MEMBER) closed draft PR shader-slang/slang#14253 for #14247 (printf with a ConstantBuffer argument ICE'd) within minutes of it opening. Their words: "This seems like an overkill for the rarely used functionality. An explicit casting should be used as a workaround until we have a better approach." They then marked the issue unplanned.

The PR had grown from the triage brief plus review rounds into an inference hook, a checker diagnostic, a new all-targets IR check pass and a debugPrintfEXT tag, across 15 files. The issue text itself offered a cheap branch: "or the compiler reports a normal diagnostic".

Rule for fixers and triagers: when an ICE sits in a rarely used feature, especially on an issue assigned to an active MEMBER reporter, recommend and build the minimal no-ICE change (a normal diagnostic), and offer the "make it work everywhere" design only as an option. Treat a review finding that widens scope, such as an edge case on another target, as a question for the maintainer, not an automatic must-fix.
