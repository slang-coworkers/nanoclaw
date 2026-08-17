---
title: "Surface-and-defer on maintainer design forks: never merge an intermediate approach; a docs-vs-compiler triage call can be right even after a long compiler detour"
type: learning
topic: agent-ops
source: learnings/1785469148746-surface-and-defer-on-maintainer-design-forks-never.md
---

# Surface-and-defer on maintainer design forks: never merge an intermediate approach; a docs-vs-compiler triage call can be right even after a long compiler detour

**Context:** shader-slang/slang#9401 (`-target hpp` "exporting functions requires entrypoint + docs mismatch"). Original triage verdict = **Approach A, docs-only** (`public __extern_cpp` → `export __extern_cpp` in `docs/cpu-target.md`), flagging the compiler-behavior questions as maintainer design calls. The chain then ran a ~2-week arc through a full compiler-change detour and landed back EXACTLY on the original docs-only recommendation. Merged as a single docs commit (PR #12242, merge e84ea3e96c, 2026-07-31).

**The arc (why it's instructive):**
1. Maintainer jkwak steered it compiler-side (add `HLSLExportDecoration`+`KeepAliveDecoration` to `__extern_cpp` at lowering) → PR #12156.
2. That was **target-neutral** (roots for every target) → regressed previously-valid `public __extern_cpp` GLSL (`main(int)` collides with compute `void main()`), caught by reviewer pdeayton via `-emit-spirv-via-glsl`. jkwak **closed #12156 unmerged**.
3. Re-implemented host-target-scoped (root only at CPU-target link via `isCPUTarget(targetReq)`) → PR #12242. Then jkwak asked to drop the `isPublic` gate; that surfaced an implicit-public visibility gap.
4. jkwak's `isPublic`-drop and reviewer csyonghe's position (`export` is the correct trigger, not `public` — "public is visibility, doesn't convey preserve-for-export") **directly conflicted**.
5. Consult resolved: `export __extern_cpp` is INTENDED behavior; #9401 is a docs bug. **All compiler changes reverted; #12242 became docs-only** = the original Approach A.

**Load-bearing lessons:**
- **Surface-and-defer every design fork to the maintainers; never merge an intermediate approach.** Because the triager/fixer chain held #12242 as draft/unmerged through every design pivot (jkwak's steer, pdeayton's regression, csyonghe's counter, the isPublic-drop, the implicit-public gap), when the maintainers finally converged the revert was a **clean single docs commit with nothing shipped to unwind**. Had any intermediate compiler design been merged, the revert would have been a real, risky change.
- **A "docs-only vs compiler-fix" triage call can be correct even when a maintainer initially steers compiler-side.** Don't treat a maintainer's steer as proof the original triage was wrong — implement what they ask, but keep surfacing the consequences (regressions, gaps) that may bring them back. Here the original docs-only rec was right all along.
- **`export __extern_cpp` vs `public __extern_cpp` (durable Slang fact):** `export` (→ `HLSLExportDecoration`+`KeepAliveDecoration` at lowering) is what preserves a function into host C++ (`-target hpp`/`cpp`) output; `public` is visibility only and does NOT root against DCE. `export __extern_cpp` = preserved + unmangled name + hpp declaration; `export` alone = preserved but mangled, no hpp decl; `public` = neither. No-entry-point export works via `-whole-program` (library mode) — decoration-independent.
- **CI-green never resolves a design-scope objection.** #12242's CI was green while the design conflict (target-neutral vs host-scoped vs docs-only) was still open; the PR-approver's BLOCK/ABSTAIN_POLICY on the scope question was vindicated by the human outcome, not the test suite.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785469148746-surface-and-defer-on-maintainer-design-forks-never.md`_
