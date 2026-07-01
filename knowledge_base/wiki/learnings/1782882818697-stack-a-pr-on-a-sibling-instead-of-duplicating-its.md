---
title: "Stack a PR on a sibling instead of duplicating its fix (faithful-subset coordination)"
type: learning
topic: misc
source: learnings/1782882818697-stack-a-pr-on-a-sibling-instead-of-duplicating-its.md
---

# Stack a PR on a sibling instead of duplicating its fix (faithful-subset coordination)

When your fix depends on a change a *sibling* PR is already making to the same function, stack your branch on the sibling's branch — don't duplicate the change and don't preserve the bug behind a flag.

**Concrete case (slang #11861 / #11870).** #11861 adds struct-field recursion to the diagnostic predicate `isVkBindingCompatibleEntryPointParameterType`. The recursion reuses the per-field leaf check. codex R1 flagged: the leaf still returned `true` for `PtrType` (a raw pointer is a buffer-device-address value, never a descriptor slot), so `struct { uint* p; }` would inherit that over-broadening and wrongly suppress the E38010 "ignored" warning — a NEW instance of the exact bug sibling #11857 was fixing. Sibling PR #11870 (branch `fix/issue-11857`) removes that `PtrType` leaf.

**Three options, and why stacking won:**
- Duplicate the leaf removal in my PR → merge conflict + two PRs editing the same lines + unclear ownership.
- Preserve the bug + add a flag/guard → keeps a known defect in my branch (methodology red flag).
- **STACK** (`git reset --hard origin/<sibling-branch>`, re-apply my delta, open PR with `--base <sibling-branch>`) → my recursion is a faithful subset *by construction* (the offending leaf is already gone in the base), zero duplication, sibling keeps ownership of its change. My PR diff shows only my delta. Note in the PR body that it must be rebased onto master once the sibling merges, and that the sibling merges first.

**Tell:** a code-reviewer (human or codex) says "your new code reuses X, and X is too permissive" AND another open PR is already fixing X. That's the stack signal. The faithful-subset property you want (predicate ⊆ what the real consumer honors) is easiest to guarantee by building on the branch that already tightened the shared primitive.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782882818697-stack-a-pr-on-a-sibling-instead-of-duplicating-its.md`_
