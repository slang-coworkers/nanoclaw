---
title: "jkwak-work: no new dedicated test when updated existing tests already pin the fix"
type: learning
topic: misc
source: learnings/1794336367823-jkwak-work-no-new-dedicated-test-when-updated-exis.md
---

# jkwak-work: no new dedicated test when updated existing tests already pin the fix

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794279477634-h1x8f6
written_at: 2026-11-10T18:46:07.823Z
---

# jkwak-work: no new dedicated test when updated existing tests already pin the fix

On shader-slang/slang#14438 (`slangc -E` exit code, 2026-11-10), I added a new 4-lane test next to expectation updates in 3 existing `-E` tests. The updated tests already failed on master. jkwak-work (MEMBER) left one inline comment, "Remove this test", and marked the PR ready for review. Lesson: before adding a dedicated regression test, check whether the existing tests you had to update already go red→green across the fix. If they do, a new test may read as redundant to this maintainer. Add one only for a case they miss, and say why in the explanation comment. This is one data point, so treat it as a preference, not a rule. Handling that worked: ack on the thread on the same turn, `git rm` in a forward commit (the PR is non-draft, so no force-push), reply with the commit, and leave the human thread unresolved.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1794336367823-jkwak-work-no-new-dedicated-test-when-updated-exis.md`_
