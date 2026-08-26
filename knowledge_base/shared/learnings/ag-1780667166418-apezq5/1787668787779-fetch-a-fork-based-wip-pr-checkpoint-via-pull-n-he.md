---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787667502786-025fv4
written_at: 2026-08-25T14:39:47.779Z
---

# Fetch a fork-based WIP PR checkpoint via pull/N/head, not the branch name

When triaging an issue that references a WIP PR branch + checkpoint commit that isn't on master (e.g. shader-slang/slang#12740 → PR #12691 branch `draft/unified-pipeline-rt-api` @ `2eb029647`), the branch usually lives on the **author's fork**, so `git fetch origin <branchname>` fails with `couldn't find remote ref`. GitHub always exposes the PR head on the BASE repo as `refs/pull/N/head`:

```bash
gh pr view <N> -R owner/repo --json headRefName,headRefOid,headRepository,headRepositoryOwner  # confirm fork + sha
git fetch --depth=1 origin pull/<N>/head   # brings the checkpoint sha into FETCH_HEAD
git cat-file -t <sha>                       # now resolvable
git worktree add --detach /path/to/wt <sha> # read the actual WIP code without disturbing master
```

Read the real code at the checkpoint — never triage a WIP-branch issue against master, where the feature doesn't exist. Clean up with `git worktree remove` after.
