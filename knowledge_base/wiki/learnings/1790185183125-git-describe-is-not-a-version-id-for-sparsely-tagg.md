---
title: "git describe is not a version ID for sparsely-tagged submodules (SPIRV-Tools) — cite the pinned SHA + commit date"
type: learning
topic: slang-compiler
source: learnings/1790185183125-git-describe-is-not-a-version-id-for-sparsely-tagg.md
---

# git describe is not a version ID for sparsely-tagged submodules (SPIRV-Tools) — cite the pinned SHA + commit date

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790129931491-nrsjwq
written_at: 2026-09-23T17:39:43.125Z
---

# git describe is not a version ID for sparsely-tagged submodules (SPIRV-Tools) — cite the pinned SHA + commit date

When reporting the version of a git-submodule pin (e.g. `external/spirv-tools`), **lead with the pinned SHA and the commit date, never the `git describe --tags` tag string.** SPIRV-Tools tags very infrequently, so `git describe` walks back to a years-old nearest annotated tag: a Sep-2026 commit (`ef96ed763b43b59b33b31b362f09a02b729fa1c9`, "Prepare release v2026.4.rc2 (#6874)", 2026-09-10, on KhronosGroup main) describes as **`v2022.4-1347-gef96ed76`** in a full clone — looking 4 years old when it is 2 weeks old. Worse, the label is clone-dependent: a shallow/alt-tag checkout can `describe` the same commit as `v2026.4.rc2` (a lightweight tag) while a full clone says `v2022.4-1347-…`. Both are the same SHA.

Concrete miss (shader-slang/slang#13230 triage): a subagent reported the submodule pin as "tag v2026.4.rc2"; maintainer jhelferty-nv saw `v2022.4-1347-gef96ed76` and challenged it as a wrong/old version. Reconciliation with receipts: `git ls-tree HEAD external/spirv-tools` (gitlink SHA) == both views; `git show -s --format=%ci <sha>` = true date; `git log -1 -- external/spirv-tools` in the SUPERPROJECT shows the roll PR (#12996, "VulkanSDK Sep 2026") and when it was pinned. Verify method: gitlink SHA + commit date + superproject bump PR are the portable, unambiguous identifiers; the `describe` tag is decorative and misleading.

Also: `gh api` in this gateway only carries shader-slang credentials — KhronosGroup/SPIRV-Tools endpoints return 401. So upstream SPIRV-Tools issue/PR status (e.g. #6711) is unverifiable here; say so, don't guess.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790185183125-git-describe-is-not-a-version-id-for-sparsely-tagg.md`_
