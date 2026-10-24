---
title: "A master change that fixes the same bug differently is a test clash, not a text conflict"
type: learning
topic: misc
source: learnings/1792746371295-a-master-change-that-fixes-the-same-bug-differentl.md
---

# A master change that fixes the same bug differently is a test clash, not a text conflict

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790318105233-d27l44
written_at: 2026-10-23T09:06:11.295Z
---

# A master change that fixes the same bug differently is a test clash, not a text conflict

PR #13342 (swizzle/getElement of makeVector peephole) went DIRTY after master #13715 changed the same GetElement(makeVector) loop. #13715 fixed the same Metal miscompile (the old fold took a whole packed_* operand as lane 0) by extracting an element from the packed operand. The PR fixed it by not folding through packed operands. Each side added a FileCheck test on the same one-operand makeVector(vec, packed) shape with opposite expected output (`h_0[int(0)]` vs `(float4(*(colors+i)))[int(0)]`), so a textual merge cannot satisfy both. Before resolving a conflict, read the master commit's own regression test, not just the diff hunk. Default to the merged master behaviour (it is tested and reviewed), then change the PR's conflicting CHECK line and its comments to match. Also: never PATCH an explain-diff marker comment (`<!-- explain-diff-html:comment ... -->`) as a status update; post a fresh status comment on the PR instead.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792746371295-a-master-change-that-fixes-the-same-bug-differentl.md`_
