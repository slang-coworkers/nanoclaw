---
title: "A slangc under a PR worktree's build/ dir may be a fetched RELEASE TARBALL, not a build of that PR"
type: learning
topic: slang-compiler
source: learnings/1786039375947-a-slangc-under-a-pr-worktree-s-build-dir-may-be-a-.md
---

# A slangc under a PR worktree's build/ dir may be a fetched RELEASE TARBALL, not a build of that PR

## The trap

A reviewer ran `/workspace/agent/wt-12155/build/slang-2026.14.1-linux-x86_64/bin/slangc` — which sits *inside* a
git worktree checked out at PR #12155's head — observed that the bug still crashed "despite the source containing
the guard", and concluded the binary did not represent the PR head.

It didn't, but not for the reason given. That executable is a **prebuilt release tarball the build system fetches
as a dependency**:

```
$ /workspace/agent/wt-12155/build/slang-2026.14.1-linux-x86_64/bin/slangc -v
2026.14.1
$ stat -c '%y' .../slangc
2026-07-30 07:23:06
```

It cannot contain the patch, so its crash carries **zero information** about the PR. The real build artifact would
be at `build/Release/bin/slangc` and did not exist yet.

## Rule

Before attributing behaviour to a PR, confirm the binary you ran is a build **of** that PR:
- `slangc -v` — but see the caveat below; it identifies the *configure-time* revision, which at least exposes a
  fetched-release binary (`2026.14.1` vs a commit-ish string).
- `stat -c '%y'` the binary and compare against when you started the build.
- Prefer the exact path your build wrote (`build/<Config>/bin/slangc`), never a `find`/glob hit — a worktree's
  `build/` legitimately contains third-party and fetched-dependency binaries with the same basename.

**A binary's location inside a source tree says nothing about which revision produced it.**

## Companion caveat: `slangc -v` is not a freshness instrument either

`-v` reports a `git describe` string **baked at cmake configure time** (`cmake/GitVersion.cmake`), so a genuinely
current build can report a revision ~80 commits stale. Establish freshness two other ways instead:

1. **Object mtimes vs the HEAD commit date**, scoped to the files your claim depends on
   (`git log --since=<object mtime> -- <those files>` empty ⇒ no drift for that claim).
2. **A behavioural discriminator** — pick a flag or diagnostic added by a commit in the range and check the binary
   responds to it, with a guilty control. Here: `-std 202c` (added by #12179) was ACCEPTED by the current Release
   build and REJECTED as `E15207 unknown language version` by a 3-hour-older Debug build in the same tree, while
   guilty control `-std 9999` errored on both. That cleanly separated two binaries whose `-v` strings were useless.

Related pitfall from the same session: four freshness probes were void before one worked — `-o /dev/null` makes
slangc fail with `E00070` (output path not associated with an entry point) so *both* the test and its control
"fail" for an unrelated reason, and guessing a flag name (`-lang-version` instead of `-std`) errors before the
parser is ever reached. **A probe where the control also fails measured nothing.**

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1786039375947-a-slangc-under-a-pr-worktree-s-build-dir-may-be-a-.md`_
