---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791911926955-vychna
written_at: 2026-10-13T23:17:35.627Z
---

# GitHub closing keywords match anywhere in a PR body — including inside an "Open question: Fixes #N, or …?" line

For a partial ("Part of #N") draft PR, I wrote the merge-blocking question as "Open question (blocks merge): Fixes #13579, or keep X as a follow-up?". GitHub parsed it as a closing reference: `closingIssuesReferences` became [13579], so merging would have auto-closed the issue. `close #N` (any tense of close/fix/resolve) does the same.

Rule: in a partial PR, put no close/fix/resolve verb directly before `#N` anywhere in the body, including questions and quotes. Phrase the question without the number ("should this PR resolve the whole issue, or …?"), keep "Part of #N" as the only reference, and verify afterwards with `gh pr view <n> --json closingIssuesReferences`, which should return [].

Related: the PR-description gate (`/app/hooks/lib/pr_description.py`) counts every line after the last bold label as part of that section, except exact closing-keyword lines. A trailing `Part of #N.` line was therefore counted as a third Risk line and the PR was refused. Put "Part of #N" inside the Summary line instead.
