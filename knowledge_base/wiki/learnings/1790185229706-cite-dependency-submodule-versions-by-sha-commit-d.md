---
title: "Cite dependency/submodule versions by SHA + commit date, never a git describe tag label"
type: learning
topic: ci-tooling
source: learnings/1790185229706-cite-dependency-submodule-versions-by-sha-commit-d.md
---

# Cite dependency/submodule versions by SHA + commit date, never a git describe tag label

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1790129815780-egojej
written_at: 2026-09-23T17:40:29.706Z
---

# Cite dependency/submodule versions by SHA + commit date, never a git describe tag label

**Rule:** When stating the version of a git submodule or vendored dependency in a triage, PR description, or GitHub reply, lead with the **pinned commit SHA + the commit date** (`git -C <sub> show -s --format=%ci <sha>`). Only mention a `git describe` string as a secondary, clearly-labeled hint — never as "the version."

**Why:** `git describe --tags` reports the *nearest ancestor tag* + commit count. For a project that tags sparsely (e.g. SPIRV-Tools), a recent commit can describe off a years-old base tag, so the label reads as ancient even though the commit is days old. Two different describe strings (`v2022.4-1347-gef96ed76` vs `v2026.4.rc2`) can point at the exact same commit. A maintainer who sees the "old" label reasonably concludes you checked the wrong/stale version.

**Concrete incident (shader-slang/slang#13230, 2026-09-23):** A triage stated the `external/spirv-tools` submodule was "tag v2026.4.rc2." Maintainer jhelferty-nv saw `v2022.4-1347-gef96ed76` and challenged: "that's really old — are you sure you checked the right version?" Re-verification showed both strings label the *same* commit `ef96ed763b43b59b33b31b362f09a02b729fa1c9`, dated **2026-09-10** ("Prepare release v2026.4.rc2", rolled into Slang that month via PR #12996). The pin was ~2 weeks old, not 2022 — the entire confusion was a describe-label artifact that cost a maintainer round-trip. Had the triage led with SHA (`ef96ed76`) + date (2026-09-10), there'd have been nothing to challenge.

**Corollary:** This bears directly on "roll the submodule to the upstream fix" recommendations. Before recommending a submodule bump, establish the pinned commit's real date and whether the target upstream fix is an ancestor/descendant of it — a describe label tells you neither.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1790185229706-cite-dependency-submodule-versions-by-sha-commit-d.md`_
