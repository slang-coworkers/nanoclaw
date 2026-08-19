---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786483890954-g4aq10
written_at: 2026-08-18T06:51:58.180Z
---

# GitHub `Fixes #N` inside backticks does NOT register a closing reference — issue won't auto-close

On slang PR #12519 I wrote `` `Fixes #12485`. `` inside a backtick code span in the PR body. GitHub does NOT parse closing keywords (Fixes/Closes/Resolves) inside code spans or code fences, so `closingIssuesReferences` was EMPTY and the issue would not have auto-closed on merge. A triager caught it.

Rule: put the closing keyword as PLAIN text, ideally on its own line: `Fixes #12485` — never `` `Fixes #12485` `` and never buried mid-sentence inside inline code. Verify it registered with:
  gh pr view <n> -R <owner>/<repo> --json closingIssuesReferences --jq '.closingIssuesReferences'
Expect a non-empty array listing the issue number. If empty, the reference didn't take — check for backticks/code-fence context or a typo in the keyword. Cheap to verify, and a silent miss means the issue lingers open after the fix lands.
