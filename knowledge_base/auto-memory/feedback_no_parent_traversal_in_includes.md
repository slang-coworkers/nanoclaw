---
name: feedback_no_parent_traversal_in_includes
description: "jkwak standing directive: no ../ parent traversal in #include paths, ALL slang PRs — repo-wide cleanup merged 07-25 (#12216, 420 files), NO CI guard, review-enforced only"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 40387747-ba2a-427a-bbb8-ffa124a500ef
---

# No `../` parent traversal in `#include` paths — standing, repo-wide

**Directive:** never use parent traversal (`../`) in `#include` paths. Applies to
**all** shader-slang/slang PRs, not to one subsystem or one review.

**Why:** parent-relative includes break when a file moves, make the include graph
depend on directory layout rather than on the include search path, and defeat
build-system reasoning about dependencies. Use the canonical path from an include
root instead.

**How to apply:** before pushing any C++ change, grep the diff for `#include "../`
and `#include <../`. If a header genuinely isn't reachable, the fix is an include
directory, not traversal.

```bash
git diff --unified=0 | grep -nE '^\+.*#include\s*[<"]\.\.\/' || echo "clean"
```

## Provenance — MINE-VERIFIED, not relayed
Surfaced 2026-08-03 by slang-fixer's orphan sweep, which found the directive in *its*
store and unreachable from any index. **My store had ZERO coverage — `include` appeared
**0 times** in `MEMORY.md`.** Verified independently before recording, rather than
taking it on report:

- **PR #12216 "Remove parent traversal from internal includes" — MERGED
  `2026-07-25T22:25:31Z`, 420 files, +1102 −1073.** A repo-wide cleanup, which is what
  makes this a convention rather than one reviewer's taste.
- Related: **#11688** (canonical `slang-rhi.h` include in mlp-training) and **#11686**
  (mlp-training-coopvec hard-coded a vendored slang-rhi include) — same class, so the
  concern predates and outlives #12216.

⚠️ **NO automated guard.** Code search finds no `.pre-commit-config.yaml` / lint rule
for it, and there is no CONTRIBUTING.md text. ⇒ **enforced by human review only**, which
is precisely why it needs to be in the store: a convention with no CI backstop is one a
reviewer catches *after* you push, and #12216 shows the cleanup cost when it drifts.

⭐ **Filing note — this arrived via the 4th store-failure mode.** Not lost, not
truncated, not a forward reference: **held in a peer's store and unindexed there, absent
from mine.** A directive can be well-recorded fleet-wide and still unreachable by every
agent who needs it. See [[feedback_narrowing_is_not_testing_check_own_store]] (the
deliverable is the index entry) and
[[project_apparatus_probe_failures_rate_limit]] (control your greps — my first check for
this used a pattern whose control returned 0, so its "absent" was meaningless until
re-run).

Related: [[feedback_correction_must_sweep_whole_file.md]] (sweep for where else a claim
lives), [[slang-routing-lessons-index]] (maintainer handles: jkwak = **jkwak-work**).
