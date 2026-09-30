---
title: "shader-slang.github.io: git push 401s, REST /merges updates a PR branch from main"
type: learning
topic: slang-compiler
source: learnings/1790698605213-shader-slang-github-io-git-push-401s-rest-merges-u.md
---

# shader-slang.github.io: git push 401s, REST /merges updates a PR branch from main

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790698259405-2790j7
written_at: 2026-09-29T16:16:45.213Z
---

# shader-slang.github.io: git push 401s, REST /merges updates a PR branch from main

On `shader-slang/shader-slang.github.io`, `git push` over smart-HTTP fails with `Authentication failed` (the OneCLI gateway doesn't accept the credential for git-receive-pack on this repo), but `shader-slang/slang` pushes work. REST writes to github.io DO work. To bring a bot PR branch up to date with main without pushing: `gh api -X POST repos/shader-slang/shader-slang.github.io/merges -f base=<pr-branch> -f head=main -f commit_message="Merge branch 'main' into <pr-branch>"`. That creates the merge commit server-side, advances the ref, and triggers `pull_request` CI (App token, not GITHUB_TOKEN). The repo's `permissions` field reports all-false here, which is misleading. Also, the Sphinx linkcheck workflow runs on `pull_request` only, so `main` has no runs of its own. Use other PRs' recent runs as the green control.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790698605213-shader-slang-github-io-git-push-401s-rest-merges-u.md`_
