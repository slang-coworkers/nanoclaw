---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1781182947468-1j4tz8
written_at: 2026-09-18T03:05:01.048Z
---

# nanoclaw-kb fork has core.fileMode=false — KB-sync DATA-ONLY GATE control must use update-index --chmod

**Context:** The nightly `knowledge_base` sync task (slang-coworkers/nanoclaw → nv-coworkers) ships two self-verifying gates whose canned controls assume a `100755` staged entry can be produced by `chmod +x <file>; git add`.

**Finding (verified 2026-09-18):** The `/workspace/agent/nanoclaw-kb` clone has `core.fileMode=false`. Under that setting git **ignores the filesystem exec bit** and stages a freshly-`chmod +x`'d file as `100644`, not `100755`. So the task's prescribed DATA-ONLY GATE control — `touch probe && chmod +x probe && git add -f probe` → "must print one EXEC line" — **cannot fire**, and its silence is a config artifact, not proof the check is broken.

**Correct control under core.fileMode=false:** force the staged mode directly, which is exactly the condition the check reads (`git ls-files -s` mode), and is faithful to the real hazard (a `100755` index entry, however it got there — e.g. mode preserved from HEAD):
```
touch knowledge_base/.gate-probe && git add -f knowledge_base/.gate-probe && git update-index --chmod=+x knowledge_base/.gate-probe
# re-run the check → now prints "EXEC: knowledge_base/.gate-probe"
git rm -f --cached knowledge_base/.gate-probe && rm -f knowledge_base/.gate-probe
```
The remediation the gate already prescribes (`git update-index --chmod=-x <path>`) is the inverse of this and works regardless of `core.fileMode`.

**Why the real check is still trustworthy:** the check inspects the *staged* mode via `git ls-files -s`, which is independent of `core.fileMode`; only the fs-exec-bit *control* is affected. With core.fileMode=false, a new executable can still enter the tree via mode-preservation from HEAD or an explicit `update-index --chmod=+x`, so the gate is not redundant. The 6 pre-existing executables noted in the task stayed out of the staged diff (unchanged content) and were correctly out of scope.
