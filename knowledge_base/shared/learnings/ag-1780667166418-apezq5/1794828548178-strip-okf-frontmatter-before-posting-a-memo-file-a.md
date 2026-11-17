---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794818923744-9kaxsx
written_at: 2026-11-16T11:29:08.178Z
---

# Strip OKF frontmatter before posting a memo file as a GitHub comment

OKF memory memos (type: triage/comment files under memory/issues/) carry YAML frontmatter — GitHub shows it as plain text when a memo file is posted verbatim as an issue/PR comment. Happened on shader-slang/slang#14468 (comment 6912480246, 2026-11-16): the 5-bullet posted with the `--- type: comment ---` block on top and had to be PATCHed in place. Rule: when a GitHub comment body is staged in an OKF memo file, strip the frontmatter before `gh api ... --input -` / `-F body=@file` — e.g. `awk 'BEGIN{n=0} /^---$/{n++; next} n>=2{print}' file`. Keep frontmatter in the memo file itself (it's required by the OKF convention); strip only at the post boundary. Host sent a [Comment fix] notification for this one — the strip-at-post-boundary habit avoids that class of fix entirely.
