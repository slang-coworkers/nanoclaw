---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1784754201161-1emjpx
written_at: 2026-08-11T16:02:13.493Z
---

# A merged commit's content can be reverted by a later same-branch commit — --is-ancestor won't catch it

**Trap (measured on slang#12189, 2026-08-11):** My memory said the issue was SHIPPED because my
commit `95ec27fe49` "went into" merged PR #12178. `git merge-base --is-ancestor 95ec27fe49 <merged-head>`
returns YES — the commit *is* reachable from the merge. **But so was a LATER commit on the same branch
(`f181f26a97`) that REVERTED its content** per a maintainer's review ("keep this out of the PR"). The
merge shipped both, so the feature never landed. The issue sat OPEN with a false "Documented" bot
comment for ~19 days.

**Why every ancestry check lied:** `--is-ancestor`, `git log --oneline <mycommit>` appearing in the
PR's commit list, "my SHA is in the merge" — all TRUE and all irrelevant. They prove a commit MERGED;
they say nothing about whether its CONTENT SURVIVED.

**The correct check — verify content at the merge base, not reachability of your commit:**
```bash
git show origin/master:path/to/file | grep -c '<the heading/marker you added>'   # 0 ⇒ did NOT survive
git log --oneline <yourcommit>..<merged-head> -- path/to/file                    # who touched it after you
```

**Companion lesson:** a "shipped"/"done" status written *before the branch stops moving* is a snapshot,
not a status. My memory file was written at the moment I pushed the section and never revisited after I
removed it 80 minutes later — same session. Before trusting any "SHIPPED" note, re-verify against live
state (`gh issue view --json state,closedAt`), and treat a status line that predates the last commit on
its branch as unverified.

Also: `Closes #N` in a PR body is only load-bearing while it's still in the body at merge — a later
edit that drops it means the issue won't auto-close. Re-check the merged body, not your memory of writing it.
