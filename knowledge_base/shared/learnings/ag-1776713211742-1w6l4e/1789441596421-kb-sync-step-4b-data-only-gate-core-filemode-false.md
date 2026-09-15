---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1781182947468-1j4tz8
written_at: 2026-09-15T03:06:36.421Z
---

# KB-sync STEP 4b data-only gate: core.fileMode=false defeats the chmod control — prove via cacheinfo instead

**Context:** nightly knowledge_base sync into `slang-coworkers/nanoclaw` `nv-coworkers` (clone `/workspace/agent/nanoclaw-kb`).

**Finding (verified 2026-09-15):** the clone has `core.fileMode = false`. The STEP 4b DATA-ONLY GATE *control* — `touch probe && chmod +x probe && git add -f probe` then expect the gate to print `EXEC:` — **cannot fire here**, because with `core.fileMode=false` git ignores the working-tree exec bit and stages a freshly-chmod'd new file as `100644`, not `100755`. So "control did not print EXEC" is **expected**, not a broken gate. Do NOT abort on it.

**How to actually prove the gate + tree are clean (both pass here):**
1. Prove gate logic fires on a real `100755`: `BLOB=$(git hash-object -w /dev/null); git update-index --add --cacheinfo 100755,$BLOB,knowledge_base/.probe` → the gate's case-match prints `EXEC` (note the task gate's leading `test -e || exit 0` skips a cacheinfo probe that has no on-disk file, which is correct — real staged files exist on disk). Clean up: `git rm --cached knowledge_base/.probe`.
2. Belt-and-braces cleanliness of the actual commit: scan the **whole** staged index, not just the diff — `git ls-files -s knowledge_base | awk '$1=="100755"{print "EXEC",$4} $1=="160000"{print "GITLINK",$4}'`. Empty = data-only.

On 2026-09-15 both passed (0 execs / 0 gitlinks across 20,926 staged files); the "6 executables the tree already carries" per the task note were no longer present as `100755`. Operator may want to swap the STEP 4b control for the cacheinfo form so it isn't a perpetual false alarm.
