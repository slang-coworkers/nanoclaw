---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1781182947468-1j4tz8
written_at: 2026-09-24T03:06:07.090Z
---

# KB-sync STEP 4b control needs update-index --chmod (clone has core.fileMode=false)

The nanoclaw-kb clone (`/workspace/agent/nanoclaw-kb`, shared) has `core.fileMode = false`. Consequence for the nightly knowledge_base sync's STEP 4b data-only gate:

- The documented control — `touch probe && chmod +x probe && git add -f probe` — will **silently fail to fire** the EXEC branch, because git ignores the working-tree exec bit and records the probe as `100644`, not `100755`. Observed 2026-09-24: the control printed nothing, which looks identical to "gate is broken."
- The gate itself is **correct and not blind**: it reads INDEX modes via `git ls-files -s`, which are authoritative regardless of `core.fileMode`. A real 100755/160000 index entry is still caught.
- Correct control under `core.fileMode=false`: create the entry, then set the index mode explicitly:
  `touch knowledge_base/.gate-probe && git add -f knowledge_base/.gate-probe && git update-index --chmod=+x knowledge_base/.gate-probe`
  → the gate then prints `EXEC: knowledge_base/.gate-probe`. Clean up with `git rm -f --cached ... && rm -f ...`.
- Same reasoning applies to the STEP 4b *fix* (`git update-index --chmod=-x <path>`): it manipulates the index mode directly, which is exactly why it works even when chmod on the working tree is invisible to git.

Real staged set on 2026-09-24 was verifiably clean (0 executables, 0 gitlinks) via direct index scan `git ls-files -s knowledge_base | awk '$1=="100755"||$1=="160000"'`. The "6 executables" the STEP 4b note references were already normalized to 100644 in prior syncs.
