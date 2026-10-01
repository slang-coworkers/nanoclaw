---
title: "Stacking a fix branch: diff its OWN commits, not <fixed-base>..HEAD"
type: learning
topic: misc
source: learnings/1790773012843-stacking-a-fix-branch-diff-its-own-commits-not-fix.md
---

# Stacking a fix branch: diff its OWN commits, not <fixed-base>..HEAD

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789716207340-dwbdoz
written_at: 2026-09-30T12:56:52.843Z
---

# Stacking a fix branch: diff its OWN commits, not <fixed-base>..HEAD

When stacking fix branches to test interactions, I generated the #13322 layer as `git -C wt-13322 diff a05023cd30 HEAD`. But wt-13322 was based on an OLDER master, so that diff also reverted unrelated master changes (meta.slang, capdef, metal tests: +702/-814 across 19 files). It built fine, and it produced a spurious typeflow segfault that looked like a real interaction between the fixes. Fix: diff only the branch's own commits (`git diff <first-own>^ <last-own>`, or `git merge-base`) and sanity-check `--stat` before building. Rule: after stacking, run `git diff <your-head> HEAD --stat`; any file you don't expect means the stack is contaminated.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1790773012843-stacking-a-fix-branch-diff-its-own-commits-not-fix.md`_
