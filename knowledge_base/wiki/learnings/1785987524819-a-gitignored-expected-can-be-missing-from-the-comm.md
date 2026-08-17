---
title: "A gitignored .expected can be missing from the commit while git status says clean"
type: learning
topic: misc
source: learnings/1785987524819-a-gitignored-expected-can-be-missing-from-the-comm.md
---

# A gitignored .expected can be missing from the commit while git status says clean

## The trap

In shader-slang/slang, **`*.expected` is gitignored** (`.gitignore:39`, alongside `*.actual`). So a
test baseline you create is:

- **not committed** by `git add <dir>` or `git add -A`
- **not shown** by `git status` as untracked
- **passing locally**, because your working tree has the file

Every "did I commit everything?" instinct comes back clean. Meanwhile the pushed commit contains the
`.slang` and not its baseline. Caught only when a reviewer ran `git ls-tree` on the commit.

There are **180 tracked `.expected` files** in-tree, so each was force-added. The repo's own note at
`.gitignore:34-36` concedes the situation: *"in some cases a `.expected` file needs to be checked in,
but trying to exhaustively enumerate those cases is hard."*

```bash
git add -f tests/path/my-test.slang.expected     # -f is mandatory
git ls-tree -r <sha> | grep my-test              # verify it is IN the commit
```

## What the missing file does to the test

`runSimpleTest` **synthesizes** a baseline when `.expected` is absent
(`tools/slang-test/slang-test-main.cpp:2187-2190`):
`"result code = 0\nstandard error = {\n}\nstandard output = {\n}\n"`, compared with strict `a == b`
(`:2132`).

⚠ Measured, twice, with clean checkouts: the test then **FAILS (0/1)** — the synthesized `rc=0`
baseline mismatches real diagnostic output. It is a **broken test, not a silently-inverted
anti-guard**. Worth stating because the first diagnosis was "it passes only if the fix does nothing,"
which is the scarier reading and the wrong one. Both readings agree the file must be committed; they
disagree about whether CI would have caught it (it would, loudly).

## The only instrument that sees what a reviewer sees

A suite number measured in your working tree is a claim about your tree, not about the commit. To
bind it to the commit:

```bash
git worktree add --detach /tmp/verify <sha>
cd /tmp/verify && git status --porcelain          # must be empty
/path/to/build/Debug/bin/slang-test -bindir /path/to/build/Debug/bin tests/whatever/
```

My reported `744/744` was measured on a tree holding the ignored file; the commit's real number was
743/744. Same wrong-binding class as reading a version from the wrong container, or counting a
multi-pass IR dump for single-pass state — **the instrument was fine and the tree was the lie.**

## Two related habits

- **Generate a `.expected`, never hand-write it.** Run the test, then `cp` the `.actual` verbatim —
  comparison is byte-exact, so a plausible-looking hand-written value (`255` where the harness records
  `-1`) fails. Confirm by moving the file aside, re-running, and diffing the fresh `.actual`.
- **A pre-fix crash is not baseline validation.** "The old harness segfaults on this test" proves the
  test fails without the fix, which a guard needs — but says nothing about whether the baseline's
  *content* is right. Confirm the post-fix pass is a **content match**, separately.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785987524819-a-gitignored-expected-can-be-missing-from-the-comm.md`_
