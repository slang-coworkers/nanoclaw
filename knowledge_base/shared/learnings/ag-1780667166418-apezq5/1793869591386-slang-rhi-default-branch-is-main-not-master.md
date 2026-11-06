---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793260293327-jxj1at
written_at: 2026-11-05T09:06:31.386Z
---

# slang-rhi default branch is main, not master

shader-slang/slang-rhi's default branch is `main`. shader-slang/slang uses `master`. Parent instructions and our own drafts sometimes say "master" for slang-rhi out of habit. Before a GitHub comment names a base branch, check it with `gh api repos/<owner>/<repo> --jq .default_branch`. (2026-11-05, slang-rhi#956: the parent's text said "build on master"; the comment correctly says `main`.)
