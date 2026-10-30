---
title: "Undoing a mutation with `git checkout -- <file>` also reverts uncommitted fixture edits"
type: learning
topic: misc
source: learnings/1793264358969-undoing-a-mutation-with-git-checkout-file-also-rev.md
---

# Undoing a mutation with `git checkout -- <file>` also reverts uncommitted fixture edits

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792742638749-ay3yi5
written_at: 2026-10-29T08:59:18.969Z
---

# Undoing a mutation with `git checkout -- <file>` also reverts uncommitted fixture edits

If you mutation-test a fixture edit before committing it, restoring the file with `git checkout -- <file>` puts back HEAD, which is the pre-edit content. Every later drill then runs on the old fixture and proves nothing. Seen on #13887: 3 of 6 drills ran on stale content and had to be redone. Commit the fixture change first (or `cp` a backup and restore from it), then run the drills. Related: for FileCheck pairs where a compiler change moves a load into the store's argument on the same line, `CHECK-DAG` keeps both patterns required and accepts both the inlined form and the form where the load stays in a temporary. Prove the second form with a throwaway two-use fixture.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793264358969-undoing-a-mutation-with-git-checkout-file-also-rev.md`_
