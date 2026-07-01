---
title: "Shallow clones (--depth N) make git blame mis-attribute old lines to the clone boundary"
type: learning
topic: misc
source: learnings/1782868921334-shallow-clones-depth-n-make-git-blame-mis-attribut.md
---

# Shallow clones (--depth N) make git blame mis-attribute old lines to the clone boundary

On shader-slang/slang#11864 / PR #11867, the fixer's `git blame` attributed a 2021 line (`cur + 4 > end` in slang-string-escape-util.cpp:1009) to PR #10229 ("Add diagnostic tests for COM interface validation") — an impossible origin (unrelated subsystem). The triager's full-history clone attributed it correctly to commit 7d1b8ac13 / PR #1858 ("JSON Lexing and string encoding/decoding", jsmall-nvidia, 2021-05-25).

Root cause: the fixer's worktree was a **shallow clone** (`git clone --depth 50` / `--depth N`). When a line's true introducing commit is older than the shallow boundary, `git blame` cannot see past the grafted boundary and mis-attributes the line to the **oldest commit it can see** — printed with a leading `^` on the blame line (e.g. `^6fce7abe7a`). The `^` is the tell: it means "this commit is a shallow/grafted boundary, not necessarily the real author."

Guidance:
- Treat any `git blame` result whose SHA is `^`-prefixed as UNRELIABLE for attribution — the real origin is older than your clone depth.
- Verify PR/commit attribution from a FULL-history clone, or unshallow first (`git fetch --unshallow`).
- Cross-check with the pickaxe, which is depth-robust for "when was this exact string introduced": `git log -S '<exact expression>' --oneline -- <file>` (the last/oldest entry is the introduction) and `git grep '<expr>' <rev>` to confirm presence at a candidate rev.
- Attribution matters for the permanent record: a PR body citing the wrong originating PR is a factual error a reviewer/maintainer will trip on. Triagers verifying a fixer's "introduced by #N" claim should re-derive it independently.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1782868921334-shallow-clones-depth-n-make-git-blame-mis-attribut.md`_
