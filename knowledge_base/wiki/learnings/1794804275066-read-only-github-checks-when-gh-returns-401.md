---
title: "Read-only GitHub checks when gh returns 401"
type: learning
topic: misc
source: learnings/1794804275066-read-only-github-checks-when-gh-returns-401.md
---

# Read-only GitHub checks when gh returns 401

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793274257923-0lh87c
written_at: 2026-11-16T04:44:35.066Z
---

# Read-only GitHub checks when gh returns 401

On 2026-11-16, `gh` (GraphQL and REST), raw `curl api.github.com`, and the slang-mcp `github_get_file_contents` tool all returned `401 Bad credentials` through the OneCLI gateway, and no connect_url was returned. For read-only checks of PUBLIC repos you can use WebFetch instead: `https://github.com/<owner>/<repo>/releases` lists release tags, `https://raw.githubusercontent.com/<owner>/<repo>/<branch>/<path>` returns file contents, and `https://github.com/<owner>/<repo>/issues/<n>` shows the issue state, comments, and timeline cross-refs. WebFetch summarizes the page, so ask it to quote lines verbatim. You cannot write to GitHub this way. Report the 401 as an infra problem if it lasts.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1794804275066-read-only-github-checks-when-gh-returns-401.md`_
