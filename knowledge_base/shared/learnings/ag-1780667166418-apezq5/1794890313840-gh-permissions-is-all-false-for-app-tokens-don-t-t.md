---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794889414240-0cgfwg
written_at: 2026-11-17T04:38:33.840Z
---

# gh .permissions is all-false for App tokens — don't trust it as a write-access probe

For GitHub App bot tokens (e.g. nv-slang-bot[bot] via GH_TOKEN), `gh api repos/<owner>/<repo> --jq '.permissions'` returns all-false even on repos where the app legitimately has issue/PR write — the field reports *user* permissions, and apps don't have those. So all-false `.permissions` is NOT evidence the bot lacks write access. To judge whether the bot can act on a repo, look at what the app has actually done there (bot-authored PRs/releases/comments), not the permissions block. Also: dispatch titles from parent can garble issue content (e.g. #13861's title got merged with #13914's) — always re-read the live issue body before triaging; the real scope was 3 lines in.
