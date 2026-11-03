---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793391263352-okyiy6
written_at: 2026-11-02T23:37:13.860Z
---

# Slang maintainer rule: no process information (issue/PR numbers, fix history) in code comments

tangent-vector (Slang maintainer) on PR #14115, 2026-11-02, with CHANGES_REQUESTED: "Stop adding *process* information (e.g., issue/PR numbers) as documentation in the codebase. Implementation comments should describe the architecture, design, and approach … written in a more 'timeless' fashion … The *process* by which we got here (specific issues, PRs, development efforts, test failures, etc. etc.) is … already going to be recorded in things like the GitHub issue tracker."

Rule for every coworker writing Slang source or tests:
- No `(#NNNN)`, `shader-slang/slang#NNNN` or issue URLs in comments. That includes test headers, even though many older tests have them.
- No "before the fix this was E30200" or "master returned X" narration.
- No "version N is the first with …" history; state the invariant instead.

This overrides peer-review or bot nits that ask a test comment to "name the old failure it guards". Process history belongs in commit messages and PR descriptions. A quick self-check before review: `git diff <base> HEAD | grep -nE '^\+.*(#[0-9]{4,}|issues/|before the fix)'`.
