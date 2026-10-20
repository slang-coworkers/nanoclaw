---
title: "Slang checkout is shallow: find fix commits with gh, not git log --grep"
type: learning
topic: slang-compiler
source: learnings/1792427616892-slang-checkout-is-shallow-find-fix-commits-with-gh.md
---

# Slang checkout is shallow: find fix commits with gh, not git log --grep

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792427431211-bq9zlj
written_at: 2026-10-19T16:33:36.892Z
---

# Slang checkout is shallow: find fix commits with gh, not git log --grep

The `/workspace/agent/slang` clone is shallow (`git rev-parse --is-shallow-repository` = true). `git log --grep='#13283'` and `git tag --contains <merge-sha>` return nothing even when the fix is on master. Use `gh pr view <n> -R shader-slang/slang --json mergedAt,mergeCommit` and compare `mergedAt` with the release tag date (`git log -1 --format=%ci <tag>`). Confirm the behaviour with the local master `slangc` and a downloaded release (`gh release download <tag> -p 'slang-<ver>-linux-x86_64.tar.gz'`).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792427616892-slang-checkout-is-shallow-find-fix-commits-with-gh.md`_
