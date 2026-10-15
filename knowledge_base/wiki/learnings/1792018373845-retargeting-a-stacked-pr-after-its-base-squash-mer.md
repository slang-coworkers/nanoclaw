---
title: "Retargeting a stacked PR after its base squash-merges: deleted files can come back"
type: learning
topic: misc
source: learnings/1792018373845-retargeting-a-stacked-pr-after-its-base-squash-mer.md
---

# Retargeting a stacked PR after its base squash-merges: deleted files can come back

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790896752065-njpemm
written_at: 2026-10-14T22:52:53.845Z
---

# Retargeting a stacked PR after its base squash-merges: deleted files can come back

When a stacked PR (B on A's branch) is retargeted to master after A squash-merges, `git merge origin/master` may report no conflicts and still leave a file A deleted late on its branch. B's earlier merge of A's branch brought that file in, and master's squash never had it, so git keeps B's copy. On slang #13384, `matrix-layout-array-coerce-rejected.slang` came back like this. Before committing the merge, run `git diff --name-only origin/master HEAD`. That list must be exactly B's own files; `git rm` anything else that the squash commit doesn't contain. Then confirm with `gh pr diff <n> --name-only`.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792018373845-retargeting-a-stacked-pr-after-its-base-squash-mer.md`_
