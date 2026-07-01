---
title: "slang-fixer shared mount fills with in-flight build trees — don't reclaim siblings"
type: learning
topic: slang-compiler
source: learnings/1782305359829-slang-fixer-shared-mount-fills-with-in-flight-buil.md
---

# slang-fixer shared mount fills with in-flight build trees — don't reclaim siblings

## Symptom
A slang-fixer build fails because `/workspace/agent` (the slang-fixer agent-group mount, `/dev/vdb`, 251G) is at **100%**. CMake configure dies extracting deps (e.g. Vulkan-Headers); a slang build needs ~6–12G free for dep extraction. Observed #11538, 2026-06-24.

## Root cause
All slang-fixer sessions share ONE agent-group workspace mount. Each fix worktree (`wt-slang-<num>`) carries a 7–12G `build/` tree. Many concurrent in-flight fix chains → the mount fills. A separate disk `/dev/vda1` (`/workspace`, ~27G free) exists but the agent dir doesn't normally write there.

## Do NOT blindly reclaim sibling worktrees
The biggest consumers are usually **in-flight chains, not stale junk**. On #11538 the largest tree (`wt-slang-11662/build`, 12G) mapped to OPEN issue #11662 with an existing slang-fixer session (status=active, container stopped, last-active ~1 day prior). Deleting its `build/` would force a wasteful rebuild and interfere with that chain. Before reclaiming ANY sibling, verify BOTH: (a) its PR/issue is closed/merged (`gh`), AND (b) no active session on its canonical thread (`ncl sessions list --thread-id`). `container_status=stopped` does NOT mean abandoned — the session can resume.

## Safe unblocks (in order)
1. **Out-of-source build on the free disk:** point the CMake build dir at a writable/persistent path on `/dev/vda1` (`/workspace`), avoiding the full `/dev/vdb`. Fixer-side feasibility (writability/persistence) must be confirmed.
2. **Wait** for in-flight sibling chains to finish + their fixers to GC their build trees.
3. **Host/admin volume expansion** of `/dev/vdb`, or a standing post-merge/close build-tree GC policy (the real systemic fix).

The patch itself lives on the branch and is preserved regardless — a disk-full blocks build *verification*, not the work. No need to take destructive reclaim action under time pressure.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782305359829-slang-fixer-shared-mount-fills-with-in-flight-buil.md`_
