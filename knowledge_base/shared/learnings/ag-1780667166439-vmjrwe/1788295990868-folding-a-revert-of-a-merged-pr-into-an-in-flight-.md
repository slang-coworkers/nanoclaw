---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788069592247-za446u
written_at: 2026-09-01T20:53:10.868Z
---

# Folding a revert of a merged PR into an in-flight PR (git checkout --ours + ABI hygiene)

When a maintainer asks to *replace* API X with API Y (rather than add Y alongside), and X came from an already-merged PR, fold the removal of X into the current PR as an extra commit.

**Resolving the revert cleanly.** `git revert --no-commit <old-commit>` of a merged PR usually conflicts, because files changed *after* the revert target — e.g. new enum values were appended below the one being removed, or new methods were added. Do NOT hand-resolve the intertwined conflict markers. Instead: `git checkout --ours <file>` (during a revert, `--ours` = current HEAD, `--theirs` = the revert result) to restore the full current content, `git add` to clear the conflict, then surgically remove *only* the revert-target's surface by hand (you know exactly what that code looks like). Keep the revert's clean deletions (whole test files, cleanly-reverted docs). This gives full control and avoids mis-merging post-target additions.

**ABI hygiene: break only what the maintainer sanctioned, no further.**
- A maintainer-sanctioned removal of a public COM vtable method is a genuine ABI break — it overrides the normal "never remove a virtual; stub it with SLANG_E_NOT_IMPLEMENTED" rule. State this explicitly in the PR Process report, and verify + note whether the removed symbol shipped in tagged releases (`git tag --contains` / check release branches) so reviewers know it's a *binary* break, not just source. Relabel `pr: breaking change`.
- If the removed method was the *last* vtable slot, no other slot renumbers — the new method simply takes the freed final slot. Update any vtable-stability probe test accordingly (slot N+1 → N).
- The associated *public enum* value should still be tombstoned per the enum rule (`REMOVED_<Name> = <int>`, integer kept reserved), NOT deleted — don't break the enum layout further than the vtable break requires. (shader-slang/slang: CompilerOptionName / include/slang.h has this rule inline + a REMOVED_SerialIR precedent.)

**Sweep for danglers the revert misses.** A `git revert` only touches what the target commit touched. Files added *later* that reference the removed symbol (sibling tests, generated coverage docs + their README index, "see also X" comments) won't be in the revert — grep the whole tree (excluding build/) for the exact identifier and fix each: repoint comments to the surviving API, delete coverage docs for removed CLI options, remove index rows for deleted files.

**Gate note.** The codex delivery gate counts *any* Edit/Write since the last approve — including edits to your own `memory/` notes outside the repo. Do bookkeeping edits BEFORE the final codex OUTPUT_REVIEW, or you'll need an extra re-approve round right before the delivery/handoff message.
