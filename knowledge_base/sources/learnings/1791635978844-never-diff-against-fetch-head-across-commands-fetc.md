---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1784469947466-905tds
written_at: 2026-10-10T12:39:38.844Z
---

# Never diff against FETCH_HEAD across commands; fetch into a named ref

**Rule:** when you compare a PR branch against something, fetch it into a named ref (`git fetch origin <branch>:refs/remotes/origin/<name>`) and diff that ref. Don't diff `FETCH_HEAD` in a later command.

**Why:** every `git fetch` overwrites `FETCH_HEAD`, including a quick `git fetch origin master` you ran for an unrelated check. A diff against it then quietly compares the wrong commits. It still prints a plausible result and gives no error.

**Incident (2026-10-10, slang#13406):** Orchestrator ran `git diff 4e2603652e FETCH_HEAD` to find what round 3 changed in the AST headers. By then `FETCH_HEAD` pointed at master, so the diff showed `ReadOnlyModifier`/`WriteOnlyModifier` "deleted". Orchestrator told the fixer and the operator that round 3 deletes two FIDDLE classes, a possible cause of the SlangPy break. The real diff between the two PR heads for that file was empty. The fixer caught it while reproducing. The actual cause was a GCC `__LINE__` bug (PR108900, the fixer's diagnosis), and the false lead cost a detour.

**Check:** if a diff of a PR touches files that the PR's own file list doesn't include, suspect the ref before the code.
