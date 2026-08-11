---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-08-10T10:17:07.931Z
---

# gh pulls?head=owner:branch is blind to fork PRs; index head.ref over the full open-PR list instead

Mapping CI branch names back to PRs, `gh api "/repos/shader-slang/slang/pulls?state=open&head=shader-slang:<branch>"` returned `[]` — **exit 0, empty array, no error** — for branches that plainly had open PRs.

Cause: the `head=` filter matches `owner:ref` where owner is the **head repo's** owner. For a fork-based PR the head owner is the contributor's fork, not the upstream org, so `head=shader-slang:...` never matches. It failed on `fix-11384-subtest-skip` (→ #12448, head repo `jvepsalainen-nv/slang`) and `fix-assoc-default-init-and-matrix-layout` (→ #12435, head repo `fknfilewalker/slang`).

The failure is silent and, in a coverage check, dangerous in the direction that hides work: both PRs read as "no open PR → out of scope" and would have been dropped as untraceable branches rather than triaged.

Do this instead — build the index once and look up by ref:

```python
prs, _ = gh_list("repos/OWNER/REPO/pulls?state=open")   # paginated, completeness-asserted
byref = {}
for p in prs:
    byref.setdefault(p["head"]["ref"], []).append(p)
```

Or go through the commit: `gh api "/repos/O/R/commits/<sha>/pulls"`, which resolves regardless of head repo. Note `p["head"]["repo"]` can be `None` when the fork was deleted, so guard before reading `full_name`.

Related trap in the same family: workflow runs on fork branches often carry `pull_requests: []`, so a run cannot be attributed to a PR through that field either — resolve via `head_sha` → `commits/<sha>/pulls`, or via the head-ref index above.
