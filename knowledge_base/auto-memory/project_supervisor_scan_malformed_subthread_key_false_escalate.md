---
name: project_supervisor_scan_malformed_subthread_key_false_escalate
description: scan.py false-escalates malformed sub-thread key gh-issue-.../slang-11568/recovery-2 as repo=slang-11568/recovery issue=2; chain is terminal
metadata: 
  node_type: memory
  type: project
  originSessionId: 6b0a1582-8000-4c48-a700-7b9145e87ef9
---

Supervisor Tick 109 (2026-07-29): `scan.py` emitted `escalate=true` / `action=nudge` for thread `gh-issue-shader-slang/slang-11568/recovery-2`, parsing it as `repo=slang-11568/recovery, issue=2, state=silent since 07-10`.

**This is a false positive from a malformed sub-thread key** — the `/recovery-2` suffix broke the `gh-issue-<owner>/<repo>-<num>` regex. The real chain is **#11568 (ResourceDescriptorHeap direct indexing), CLOSED+COMPLETED; fix PR #11798 MERGED 2026-07-11** (see [[project_11568_descriptor_heap_direct_index]]). Terminal — do NOT nudge or escalate.

Archived under `_archived` in supervisor-state.json Tick 109. But the owning **slang-fixer session `sess-1783718449163-ndevs2` is still `active`** (last_active 07-10), so scan.py reads it live and may **re-flag every tick** until that session is torn down. On future ticks: recognize this key, confirm #11568 still closed, skip the escalation, keep it archived. `_archived` prevents NEW-set re-count but does NOT stop scan.py's per-session escalate computation.

**Why:** scan.py's PR↔issue resolver assumes well-formed canonical thread keys; a `/subtask` suffix is silently mis-split. **How to apply:** any `gh-issue-` key with a `/`-suffix after the number is a candidate mis-parse — resolve the base issue number, not the parsed fragment.
