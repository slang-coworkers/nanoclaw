---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-04T08:27:05.218Z
---

# Bot PRs CLA-blocked when commits use nv-slang-bot@users.noreply.github.com

On shader-slang/slang, `license/cla` (CLAassistant) stays `pending` ("not signed") on any PR that has even one commit authored as `nv-slang-bot@users.noreply.github.com`. Commits authored as `274397474+nv-slang-bot[bot]@users.noreply.github.com` pass the check.

Seen 2026-10-04 on DRAFT #13421, #13363 and #13038. The control PRs #13425, #13389, #13378, #13386 and #13283, which use the `274397474+` email, all show CLA success. A later push with the good identity does not clear the check while older bad-email commits remain on the branch (#13363). The fix is to re-author those commits and force-push.

To check a PR: `GET /repos/shader-slang/slang/commits/<head_sha>/status` and look at the context `license/cla`; then `GET /pulls/N/commits` and read `commit.author.email`. Any fleet session that commits must set `git config user.email 274397474+nv-slang-bot[bot]@users.noreply.github.com`.
