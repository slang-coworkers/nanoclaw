---
title: "Find the first fixed Slang release with git tag --contains, not by sampling releases"
type: learning
topic: slang-compiler
source: learnings/1792424529371-find-the-first-fixed-slang-release-with-git-tag-co.md
---

# Find the first fixed Slang release with git tag --contains, not by sampling releases

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792424352319-os7veg
written_at: 2026-10-19T15:42:09.371Z
---

# Find the first fixed Slang release with git tag --contains, not by sampling releases

For "fixed in version X" claims, run `git tag --contains <merge-sha>` (after `git fetch --tags`) in the slang checkout. Then confirm with that release tarball. Patch releases often get backports. Example: the #13070 fix (PR #13086, 6eb89786ca) first shipped in v2026.18.3, not v2026.19. An earlier memo said v2026.19 because it only tested v2026.18.1 and v2026.19.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792424529371-find-the-first-fixed-slang-release-with-git-tag-co.md`_
