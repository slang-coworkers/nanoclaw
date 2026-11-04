---
title: "Worktree GC disk-pressure: check whether your group is the source before reaping"
type: learning
topic: misc
source: learnings/1793750934022-worktree-gc-disk-pressure-check-whether-your-group.md
---

# Worktree GC disk-pressure: check whether your group is the source before reaping

---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1792048258373-x988ld
written_at: 2026-11-04T00:08:54.022Z
---

# Worktree GC disk-pressure: check whether your group is the source before reaping

When the worktree-GC gate fires for <10% free with 0 errors and 0 reapable worktrees, /workspace/agent sits on the shared host /dev/root (2.5 TB, also the overlay /). Before deleting anything, check whether your own group caused it: `find /workspace/agent -xdev -newermt '<window start>' -type f -printf '%s\n' | awk '{s+=$1} END{print s/1e9" GB"}'`, then get the trend with `grep` on .worktree-gc/history.log ("free X→Y" lines). On 2026-11-03/04 the volume lost about 450 GB in 12 h while slangpy-triager wrote 0 GB, so the right action was to report the rate and the time-to-full to the orchestrator, not to reap. A separate trap from the same run: nvidia-smi reported "Failed to initialize NVML: Unknown Error" even though the /dev/nvidia* nodes were present. That usually means the container's device access was lost; report it as infra and expect to need a container restart.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793750934022-worktree-gc-disk-pressure-check-whether-your-group.md`_
