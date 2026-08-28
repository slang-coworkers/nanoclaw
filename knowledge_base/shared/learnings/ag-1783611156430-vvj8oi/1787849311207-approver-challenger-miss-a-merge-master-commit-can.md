---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787073714994-haqfk9
written_at: 2026-08-27T16:48:31.207Z
---

# [approver/challenger-miss] A merge-master commit can silently regress a submodule pointer backward — diff every submodule bump against master

## Symptom
PR #12522 (shader-slang/slang) was a focused loop-unroll IR fix. Devin was clean (bugs 0, flags 0),
CI was green, and the domain maintainer APPROVED at the exact head. The clean-looking change
nonetheless carried an **unrelated backward submodule move**: the PR head shipped
`external/slang-rhi = 29dc332e`, a strict ancestor **36 commits behind** current master's
`d6d31411` (set deliberately by master PR #12615 "Update slang-rhi to ToT"). `gh pr diff` showed
`-d6d31411 +29dc332e` — merging the PR would have reverted slang-rhi backward, undoing #12615.

## Root cause
The regression entered via the human's `Merge branch 'master' into <branch>` commit, which kept the
**branch's stale submodule pointer** instead of taking master's newer one (a classic merge-resolution
default for submodules). Nothing in the PR's stated purpose (a compiler IR pass) needs a specific
`external/slang-rhi` (render-hardware-interface) revision, and no PR comment mentioned slang-rhi — so
it was an unintended merge artifact, not an intended change. The reviewer who approved was also the
one who performed the merge, so a one-line submodule pointer diff was easy to miss in a large
Files-changed view. **Neither Devin, nor CI-green, nor a human approval flags a backward submodule
move**: CI only proves the older pointer still builds/passes, not that the reverted work is preserved.

## How to catch it
When a PR's changed-file list includes a submodule gitlink (mode `160000`, e.g. `external/*`) that is
NOT part of the PR's stated purpose:
1. Resolve the pointer at the PR head vs at current master:
   `gh api repos/OWNER/REPO/contents/<submodule-path>?ref=<head>` and `?ref=master`.
2. If they differ, compare direction in the SUBMODULE repo:
   `gh api repos/OWNER/SUBMODULE/compare/<head-ptr>...<master-ptr>` — `status: ahead` / `behind_by: N`
   means the PR is **behind** master (a backward move that would undo a merged master bump).
3. A backward, out-of-scope submodule move = OPEN_GAP (plausible trigger = merge, real blast radius =
   reverting another merged PR). Forward bumps that match/lead master are usually benign merge
   catch-ups; still confirm they're intended.
The tell: an `external/<sub>` or other `160000` gitlink appears in `gh pr diff --name-only` for a PR
whose title/scope is unrelated to that submodule — especially right after a "merge master" commit.

## Fix / decision
ABSTAIN_POLICY:OPEN_GAP — the loop-unroll change was sound, but a human must restore/confirm the
`external/slang-rhi` pointer (re-merge master or reset to master's value) before merge. General rule:
**a clean in-scope change never launders an unrelated regression the same commit would ship** — decide
on the whole diff the merge would land, not just the diff the PR set out to make.
