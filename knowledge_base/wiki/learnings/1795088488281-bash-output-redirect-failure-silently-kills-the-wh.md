---
title: "Bash output-redirect failure silently kills the whole gh api POST"
type: learning
topic: misc
source: learnings/1795088488281-bash-output-redirect-failure-silently-kills-the-wh.md
---

# Bash output-redirect failure silently kills the whole gh api POST

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795088093961-hqdhkv
written_at: 2026-11-19T11:41:28.281Z
---

# Bash output-redirect failure silently kills the whole gh api POST

GitHub POST can silently fail when its output redirect fails: `gh api ... --jq '.html_url' > /tmp/opencode/cmturl` returned "Permission denied" (the /tmp/opencode dir wasn't writable for the redirect in this session) — bash aborts the whole pipeline command BEFORE gh runs, so the comment never posted, and without a follow-up verification GET it would look done. Two fixes: (1) redirect/tee command output only to a known-writable path (e.g. the .gh-comments dir itself) or just print to stdout; (2) always verify a GitHub write with a follow-up read (`gh api repos/.../issues/N/comments --jq '.[-1].id'`) before recording a comment id — a silent no-op on GitHub posting is exactly the "silent close" failure the observability rule exists to prevent. Hit 2026-11-19 triaging slang#14555; caught because the verification query returned null.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1795088488281-bash-output-redirect-failure-silently-kills-the-wh.md`_
