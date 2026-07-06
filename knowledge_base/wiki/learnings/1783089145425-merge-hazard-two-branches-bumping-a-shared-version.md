---
title: "Merge hazard: two branches bumping a shared version counter collapse to one value (git can't see it)"
type: learning
topic: misc
source: learnings/1783089145425-merge-hazard-two-branches-bumping-a-shared-version.md
---

# Merge hazard: two branches bumping a shared version counter collapse to one value (git can't see it)

# Silent version-counter collision when merging IR-inst / stable-name PRs

**Context:** resolving conflicts on shader-slang/slang#11541 (fix/issue-11538, shader64BitIndexing decoration) when merging master (78 commits).

## The non-obvious hazard
`source/slang/slang-ir.h`'s `k_maxSupportedModuleVersion` is a monotonic counter bumped whenever IR instructions are added. Merge-base was **22**. Master bumped 22→**23** (workgraph #11437) and the feature branch independently bumped 22→**23** (for its own added inst). Git did a clean **textual** auto-merge — both sides wrote the identical literal `23`, so it produced `23` with NO conflict marker. But that's semantically WRONG: the two `23`s represent DIFFERENT instruction-set additions. The branch's inst is added *on top of* master's already-published v23 (which doesn't contain it), so a v23 reader/writer would be ambiguous. **Correct merged value = base+2 = 24.** codex-critique independently confirmed 24 over shared-23.

**Rule of thumb:** any time two branches increment a shared "next-free"/version counter from the same merge-base, git's textual merge understates it by one. After ANY master-merge on a PR that bumped `k_maxSupportedModuleVersion` (or added stable names), manually diff the merge-base value against both parents and set the merged value to base + (number of independent increments), not the git-auto-merged literal. Same logic guards `slang-ir-insts-stable-names.lua` (value collisions git also won't flag — a key added at N on one branch and a different key at N on the other merge cleanly into a DUPLICATE value; grep `= [0-9]+` | sort -n | uniq -d after every such merge).

## Companion build gotcha (same session)
A worktree that has been merged/rebased can carry a STALE `external/imgui` checkout (e.g. v1.62-531) even though the recorded submodule pointer is correct/newer. Symptom: `tools/platform/gui.cpp:366: fatal error: imgui_tables.cpp: No such file or directory` (that file was added in a much newer imgui). It is NOT a code/merge defect — `slangc` doesn't need imgui; only slang-test/render-test pull in the platform GUI tool. Fix: `git submodule update --checkout external/imgui` (then rebuild incrementally). `git submodule status external/imgui` showing a leading `+` = working-tree checkout differs from recorded pointer. Also: harmless mangled `-I tools/(` / `-I tools/not` include flags in a target's compile line come from a CMakeLists `if()`/`option()` quirk, not a broken configure — ignore them if unrelated targets built fine.

## Monitor gotcha
`Monitor`/until-loop using `pgrep -f '<literal build cmd>'` SELF-MATCHES the monitor's own shell command line → the loop never exits → the monitor times out instead of firing. Detect build completion by writing a sentinel INTO the log (`cmd > log 2>&1; echo "BUILD_EXIT=$?" >> log`) and grep the log for it, not via pgrep.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1783089145425-merge-hazard-two-branches-bumping-a-shared-version.md`_
