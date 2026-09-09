---
title: Slang Dev Craft — Git, Build, Blast-Radius Grep, and FileCheck
type: concept
group: misc
tags: [git, rebase, pathspec, ninja-build, filecheck, slang-test, blast-radius, grep, benchmark]
source_count: 12
---

## TL;DR

Mechanical traps in the day-to-day fix/build/test loop on Slang — git reference-point errors,
concurrent-build races, false-clean diffs, blast-radius grep scoping, and FileCheck region-scoping.
Each is a "correct tool, wrong reference point / wrong scope" failure that produces a plausible but
wrong result.

- **`git checkout master -- <file>` restores from master TIP, not your merge-base** — silently
  pulling unrelated upstream edits into your branch. Restore from `$(git merge-base HEAD master)`
  and verify with the THREE-dot diff (`git diff master...HEAD --name-only`).
- **A quoted `*.cpp` git pathspec (`'source/slang/*.cpp'`) silently matches NOTHING** — an inert-glob
  empty diff is byte-identical to a genuine "no change." Use no-pathspec full changeset or a
  byte-hash; three-dot uses merge-base (shows rebase artifacts as "modified"), two-dot for "what
  actually differs."
- **Rebase onto current origin/master BEFORE the code critique** — a fix verified against a stale
  base is verified against code that no longer exists; a no-conflict rebase proves the TEXT merged,
  not that the BEHAVIORS compose.
- **A large rebase can silently REVERT a recently-landed sibling PR** in the same file region —
  verify the net effect at the actual PR head (`contents?ref=<head-sha>`), not by eyeballing hunk +/-.
- **A patch-scoped grep undercounts a repo-wide idiom's blast radius** — a convention lives wherever
  it's *documented* (a `_meta`/prompt file that mandates it) and in every test tree it runs in
  (`docs/generated/tests/` runs nightly), not just where your patch touches. Host-conditional guards
  need per-platform blast-radius checks.
- **A scratch PR-body file can leak into the commit via a blanket `git add`** — after every
  commit/amend run `git show --stat HEAD`; CodeRabbit's "Files selected for processing" is a free
  sanity check.
- **Never run two ninja builds in the same `build/` dir** — an `objcopy: input file is empty` race;
  kill by pid+cwd, run exactly one serialized build.
- **FileCheck `CHECK-LABEL` blocks must be in EMIT order, and `CHECK-NOT` is REGION-scoped** — a
  whole-output "never appears" assertion needs its OWN absence-only prefix.
- **A non-expanding filler swap in a benchmark generator must stay op-count AND growth-character
  neutral**; pin the property, not a literal coefficient.

## Git reference-point and diff-instrument traps

Three atoms are variations of "the tool used a different reference point than you assumed." `git
checkout master -- <file>` restores from the current master tip: on slang#12647 it pulled an
unrelated upstream `-warnings-disable` docstring edit that was present at master tip but absent at the
merge-base, so a three-dot diff then blamed the branch for it. Restore from the merge-base
(`MB=$(git merge-base HEAD master); git checkout "$MB" -- <file>`) and confirm with the three-dot
`--name-only` ([git checkout master -- <file> restores from master TIP, not the PR
merge-base](../learnings/1787637340749-git-checkout-master-file-restores-from-master-tip-.md)).
A quoted `*.cpp` pathspec returns EMPTY even when those files changed — git's default pathspec doesn't
treat `*` as spanning a path segment, and neither the plain glob nor `:(glob)` magic is reliable
across git subcommands, so a verdict-bearing "did X change" check must use a no-pathspec full
changeset OR an independent byte-hash (`git cat-file blob <A>:path | sha256sum`); note three-dot
`compare/A...B` uses merge-base and shows files "modified" after a REBASE even when two-dot content is
identical ([git default pathspec 'dir/*.cpp' silently matches nothing — a false-clean
diff](../learnings/1787658137006-git-default-pathspec-dir-cpp-silently-matches-noth.md)). And a
fix must be rebased onto current origin/master before the code critique: on #12623 a base 21 commits
behind had merged a feature emitting CUDA `__noinline__` in the exact preamble branch being edited, so
a clean (no-conflict) rebase auto-merged two individually-valid edits into a jointly-invalid
`__forceinline__ __device__ __noinline__` — a no-conflict rebase proves the TEXT merged, not that the
BEHAVIORS compose ([rebase onto current origin/master BEFORE the CODE critique, not after the fix is
"done"](../learnings/1787661100185-rebase-onto-current-origin-master-before-the-code-.md)). The
review-side mirror: a large rebase can silently revert a recently-landed sibling PR — reviewing
#12672 the fixer's "7 upstream commits" clobbered #12670's `RayDesc` hoist back inside the OptiX
`#ifdef`; verify the net effect at the actual PR head (`contents?ref=<head-sha>` → base64 -d), not by
eyeballing hunk direction ([a large rebase can silently revert a recently-landed sibling
PR](../learnings/1787673424885-a-large-rebase-can-silently-revert-a-recently-land.md)).

## Blast-radius grep, scratch-file hygiene, and build races

A patch-scoped grep undercounts a repo-wide idiom (two atoms, both from slang#12717 which made
slang-test reject absolute `-o` paths). Grepping only `tests/**` found 3 affected files, but the
`-o /dev/null` idiom is MANDATED by `docs/generated/tests/_meta/prompts/_common.md` and used by ~972
`.slang` files under `docs/generated/tests/` that nightly CI runs — a blanket reject would be a
~1000-file regression. When a change forbids/changes a token or convention, grep the ENTIRE repo (all
test trees, generated dirs, docs) and check whether a `_meta`/prompt/doc file *mandates* the pattern;
`-o -` is NOT equivalent to `-o /dev/null` (it mixes target text with the IR dump). The second atom
adds that a host-conditional exemption (`/dev/null` exact-match on POSIX, `NUL` case-insensitive on
Windows) changes the blast radius PER platform — the Linux-only nightly tree was unaffected but the
cross-platform every-PR suite was not, so enumerate a guard's effect on EACH platform's CI leg
separately ([a patch-scoped grep undercounts a repo-wide idiom's blast
radius](../learnings/1787608994784-a-patch-scoped-grep-undercounts-a-repo-wide-idiom-.md),
[host-conditional guards need per-platform blast-radius
checks](../learnings/1787659716816-a-patch-scoped-grep-undercounts-a-repo-wide-idiom-.md)).

A scratch PR-body file (`.pr-body-11317.md`) leaked into a fix commit via a blanket `git add
source/... tests/... .pr-body-*.md`, unnoticed until CodeRabbit's "Files selected for processing" list
showed it. After every commit/amend run `git show --stat HEAD` and confirm only intended files; stage
source/tests explicitly, leave scratch files untracked (a `.git/info/exclude` entry is cheap
insurance); fix it with `git rm --cached` + a small follow-up commit, never a force-push over a
maintainer's "Update branch" merge ([scratch PR-body file can leak into the commit via git add during
--amend](../learnings/1787566872697-scratch-pr-body-file-can-leak-into-the-commit-via-.md)). And
never launch a second `cmake --build` against a `build/` dir a build subagent is already building —
two ninjas racing corrupt intermediates (`objcopy: the input file '…libslang-without-embedded-core-
module.so' is empty`), which is the race, not your source; recover by killing ninja scoped to the
worktree by pid+cwd (never `pkill -f`) and running exactly one serialized build with no mid-build
`cmake -E touch` ([never run two ninja builds in the same build/ dir — objcopy 'input file is empty'
race](../learnings/1787615532680-slang-build-never-run-two-ninja-builds-in-the-same.md)).

## FileCheck region-scoping and benchmark-generator neutrality

Three FileCheck facts recur. `CHECK-LABEL` blocks must appear in the order the compiler EMITS the
functions, not source-declaration order — FileCheck scans forward-only, so a mis-ordered `-LABEL`
consumes the cursor past an earlier-emitted function's later `-LABEL`, giving a false "expected string
not found" while the string is present (a partial FileCheck failure alongside passing correctness
sub-tests is the tell that the *test ordering* is wrong, not the compiler); dump the emission order
and reorder ([FileCheck CHECK-LABEL blocks must be in emit order, not source
order](../learnings/1787564174427-filecheck-check-label-blocks-must-be-in-emit-order.md)). And a
`CHECK-NOT` is REGION-scoped — bounded by the surrounding positive checks — so a `-NOT` placed after
your positive checks misses a regression emitted *before* the first positive match, and between two
`CHECK-DAG`s there is an unscanned interval where a forbidden token escapes both. For a true
"X must never appear anywhere" assertion, give it its OWN filecheck prefix whose only directives are
`CHECK-NOT` (an absence-only prefix has no bounding positive anchor, so it scans the entire output);
slang-test supports multiple prefixes on one `-target` run, and you prove it non-vacuously with a
must-fail mutation drill ([CHECK-NOT is region-scoped — use a dedicated NOT-only
prefix](../learnings/1787629056398-filecheck-check-not-is-region-scoped-use-a-dedicat.md),
[FileCheck -NOT between positive matches has interval blind spots; use an absence-only
prefix](../learnings/1787699239962-filecheck-not-between-positive-matches-has-interva.md)).
Adjacent gotchas: a directive token in a `.slang` comment (`HLSL:`, `SPIRV:`) is parsed as a real
directive — keep them out of prose; and a byte-address store has no template arg, so `-NOT: Store<void`
is vacuous.

Finally, when replacing "filler" math in a synthetic benchmark generator (Slang compile-perf
`gen_codegen`) to fix a downstream-target expansion (`sin`/`cos` → software `::sinf`/`::cosf` blows up
CUDA PTX), the swap must preserve TWO properties: op-count/constant-factor neutrality (dropping ops
changes per-iteration cost for every fanned-out target) and the growth character of the recurrence
(the original `... - cos(...)*0.25` was contractive at ~0.8759; a replacement summing to ~1.1259
compounds and overflows float32). And an import-time regression guard should pin the real invariant
(`sin`/`cos`-free), not an exact coefficient literal that fails on any routine retune ([non-expanding
filler swap must stay op-count and growth-character
neutral](../learnings/1787559069231-non-expanding-filler-swap-must-stay-op-count-and-g.md)).

**Source learnings (12):**
- [Scratch PR-body file can leak into the commit via git add during --amend](../learnings/1787566872697-scratch-pr-body-file-can-leak-into-the-commit-via-.md) — `git show --stat HEAD` after every commit; CodeRabbit's file list is a free check.
- [Slang build: never run two ninja builds in the same build/ dir](../learnings/1787615532680-slang-build-never-run-two-ninja-builds-in-the-same.md) — objcopy 'input file is empty' race; kill by pid+cwd, run exactly one serialized build.
- [git checkout master -- <file> restores from master TIP, not the PR merge-base](../learnings/1787637340749-git-checkout-master-file-restores-from-master-tip-.md) — restore from `git merge-base`; verify with the three-dot diff.
- [git default pathspec 'dir/*.cpp' silently matches nothing — a false-clean diff](../learnings/1787658137006-git-default-pathspec-dir-cpp-silently-matches-noth.md) — use no-pathspec changeset or byte-hash; three-dot vs two-dot for rebase artifacts.
- [Rebase onto current origin/master BEFORE the CODE critique, not after the fix is "done"](../learnings/1787661100185-rebase-onto-current-origin-master-before-the-code-.md) — a no-conflict rebase proves text merged, not that behaviors compose.
- [A large rebase can silently revert a recently-landed sibling PR](../learnings/1787673424885-a-large-rebase-can-silently-revert-a-recently-land.md) — verify net effect at the PR head, not by eyeballing hunk +/- direction.
- [A patch-scoped grep undercounts a repo-wide idiom's blast radius](../learnings/1787608994784-a-patch-scoped-grep-undercounts-a-repo-wide-idiom-.md) — a convention lives wherever it's documented; docs/generated/tests runs nightly.
- [A patch-scoped grep undercounts a repo-wide idiom; host-conditional guards need per-platform checks](../learnings/1787659716816-a-patch-scoped-grep-undercounts-a-repo-wide-idiom-.md) — a per-platform exemption changes the blast radius per CI leg.
- [FileCheck CHECK-LABEL blocks must be in emit order, not source order](../learnings/1787564174427-filecheck-check-label-blocks-must-be-in-emit-order.md) — dump the emission order and reorder; a partial fail is a test-ordering tell.
- [FileCheck CHECK-NOT is region-scoped — use a dedicated NOT-only prefix](../learnings/1787629056398-filecheck-check-not-is-region-scoped-use-a-dedicat.md) — an absence-only prefix scans the entire output; prove it with a must-fail mutation.
- [FileCheck -NOT between positive matches has interval blind spots; use an absence-only prefix](../learnings/1787699239962-filecheck-not-between-positive-matches-has-interva.md) — split into a "present" prefix and an all-CHECK-NOT prefix.
- [Non-expanding filler swap must stay op-count and growth-character neutral](../learnings/1787559069231-non-expanding-filler-swap-must-stay-op-count-and-g.md) — preserve op-count + recurrence sign; pin the property (sin/cos-free), not a literal.
