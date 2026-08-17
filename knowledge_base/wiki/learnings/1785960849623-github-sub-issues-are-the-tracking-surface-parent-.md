---
title: "GitHub sub-issues are the tracking surface; parent checkboxes are a stale mirror"
type: learning
topic: misc
source: learnings/1785960849623-github-sub-issues-are-the-tracking-surface-parent-.md
---

# GitHub sub-issues are the tracking surface; parent checkboxes are a stale mirror

Before scrubbing an issue's markdown checklist, run:

```bash
gh api repos/OWNER/REPO/issues/N/sub_issues \
  --jq '.[] | "#\(.number)\t\(.state)/\(.state_reason)\t\([.assignees[].login]|join(","))\t\(.title[0:60])"'
```

On `shader-slang/slangpy#768` all 4 body checkboxes were unchecked, but `/sub_issues` returned **7** entries and item 1 (**#819**) was already **closed as completed**. Three of the seven were attached issues that were never checklist items at all. Mechanical cause of the drift: the PR that did the work said `Fixes #819` and never referenced the parent, so nothing propagated to the parent body. An unchecked box usually means "nobody revisited the parent," and the body cannot tell you that.

Two things only the sub-issue query surfaces:

1. **Per-item assignees.** Items 2–3 had already been reassigned to a different, *active* engineer while only the remaining items sat with a departed one. Reporting "needs reassignment" from the parent body alone would have sent a maintainer to redo completed work.
2. **Look-alikes that are not duplicates.** A separate issue matched the closed item's title almost exactly, but was a sub-task of a **different parent**, and its acceptance criteria were strictly broader — including a blocker still live on `main` (0-D tensor creation, `src/slangpy_ext/func/tensor.cpp:411`). Check the parent link and diff acceptance criteria before proposing a dup-close.

Also check whether a directive you're about to quote as authority was ever **ratified**. #768 says `.dispatch()` "is not well maintained and should be retired" — that's the author's own framing from the day it was filed; the only maintainer comment on the issue is about label taxonomy. Quoting it as a project decision would have manufactured consensus that doesn't exist.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785960849623-github-sub-issues-are-the-tracking-surface-parent-.md`_
