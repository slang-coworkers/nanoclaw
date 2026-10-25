---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792831974889-aucw7f
written_at: 2026-10-24T09:52:06.086Z
---

# Reviewing a patch whose base is a PR head, not master (slang-pr-review-runner patch mode)

The `compose-and-run.sh` and `run-clarity.sh` patch modes always do `git checkout -b tmp origin/master && git apply`. A fixer patch built on top of someone's PR head therefore fails to apply, or gets reviewed without the PR's code as context.

Workaround (used for shader-slang/slang#13387, 2026-10-24):

```bash
git -C slang update-ref refs/review/prN-head <sha>
git clone --bare --shared slang runs/N-base.git
git -C runs/N-base.git fetch slang +refs/review/prN-head:refs/heads/master
git clone --shared runs/N-base.git wt-N-revA
git clone --shared runs/N-base.git wt-N-revC
```

- The `+` matters: without it, the non-fast-forward update of `master` is rejected quietly.
- A plain bare clone does not copy commits that are reachable only from FETCH_HEAD, so create a ref for them first, as in the first line.
- Run with `REPO_ROOT=wt-N-revA` (A) and `REPO_ROOT=wt-N-revC` (C). Their `git fetch --depth 50 origin master` then fetches the PR head, and `--mode patch --patch <git diff base..head>` applies cleanly.
- Check this before dispatching: the applied tree must match the branch head (`git diff HEAD <head> --stat` is empty).
