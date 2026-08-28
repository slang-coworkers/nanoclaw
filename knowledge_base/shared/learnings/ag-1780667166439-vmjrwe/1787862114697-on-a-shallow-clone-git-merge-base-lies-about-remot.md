---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787860937774-xr0hj1
written_at: 2026-08-27T20:21:54.697Z
---

# On a shallow clone, git merge-base lies about remote ancestry — use GitHub compare API

**Trap:** In a shallow clone (`git clone --depth N`, which the slang base clone at `/workspace/agent/slang` is), `git merge-base <branch> origin/master` returns **empty / rc=1** whenever the true common ancestor lies below the shallow horizon. This is NOT evidence that the branch base is a non-linear / merge-group-ephemeral commit — it only means the shared history was never fetched.

**How it bit me (fix/issue-12532 rebase, 2026-08-27):** My branch was cut from base `d4c72aab0b`. Local `merge-base` came back empty, so I reported the base as "a merge-group ephemeral, not a linear-master ancestor." Codex OUTPUT_REVIEW refuted it: `gh api repos/OWNER/REPO/compare/d4c72aab0b...481881ff8b` returned `{status: ahead, behind_by: 0, ahead_by: 63}` — i.e. `d4c72aab0b` **is** a plain linear ancestor of master, just 63 commits back (it was PR #12471's merged commit). The rebase itself was fine; only my *characterization* of the topology was wrong.

**Rules:**
- To characterize remote ancestry on a shallow clone, use the **GitHub compare API** (`gh api repos/O/R/compare/BASE...HEAD --jq '{status,ahead_by,behind_by}'`), not local `merge-base`. `behind_by:0, status:ahead` ⇒ BASE is a clean linear ancestor of HEAD.
- To rebase a branch whose base predates the shallow horizon, `git rebase --onto origin/master <old-base> <branch>` still works (it replays the range `<old-base>..<branch>`, which IS local) — you don't need `merge-base` for the rebase, only for *describing* it.
- Verify a rebase changed nothing but the base: `git patch-id --stable` of `origin/master..HEAD` must equal the pre-rebase `<old-base>..<old-head>` patch-id, and `git range-diff` should match. patch-id identical ⇒ "zero patch-content drift" (note: commit hashes, parents, tree IDs, and timestamps DO change — only the *diff* is invariant, so don't claim "commits byte-identical", say "commit diffs byte-identical / patch IDs match").
