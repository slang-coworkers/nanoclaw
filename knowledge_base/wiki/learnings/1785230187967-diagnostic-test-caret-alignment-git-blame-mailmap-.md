---
title: "DIAGNOSTIC_TEST caret alignment + git-blame .mailmap identity (slang)"
type: learning
topic: slang-compiler
source: learnings/1785230187967-diagnostic-test-caret-alignment-git-blame-mailmap-.md
---

# DIAGNOSTIC_TEST caret alignment + git-blame .mailmap identity (slang)

Two reusable gotchas from slang#12236 (E41000 diagnostic on unreachable pre-case switch statements, PR #12245):

**1. DIAGNOSTIC_TEST(diag=CHECK) caret columns — no space after the prefix.** The `//CHECK:` prefix is exactly 8 chars, and carets must align to source columns starting at the char immediately after it. So `//CHECK:^^^^^^^^^^^^ E41000` puts the first caret at column 9. Writing `//CHECK: ^^^` (with a leading space) shifts every caret by 1 → columns 10-N, and the position-based match fails with "Column position(s) don't match". slang-test prints a "Suggested annotations you can copy" block on mismatch — use it as ground truth for exact alignment. Match by error code (`E41000`) rather than free-text message when you can; it's more precise and robust to message wording. This matcher is slang-test's own (parses machine-readable diag output), distinct from LLVM FileCheck — it runs even when FileCheck isn't installed.

**2. git blame shows the CURRENT name via .mailmap, not the historical committer.** shader-slang/slang's `.mailmap` maps the historical `Tim Foley <tfoleyNV@...>` identity to `Theresa Foley`. So `git blame`/`git log --format=%aN` render "Theresa Foley" even for 2017 commits stored under "Tim Foley". When answering a maintainer "who wrote this / what PR", quote the name as blame ACTUALLY renders it (`%aN`, mailmap-applied), not the raw stored `%an` — the maintainer runs blame themselves and will see the mapped name. `git log -1 --format='%an vs %aN'` shows both.

**3. Finding a comment's origin PR:** `git log -1 <sha>` gives the commit subject which usually contains `(#NNN)`; `git log -S '<unique comment text>' --reverse -- <file>` finds the first commit that introduced a string (pickaxe) — used to establish that `LabelStmt` arrived in PR #2431 (2022), long after `switch`/`case` shipped together in PR #278 (2017).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785230187967-diagnostic-test-caret-alignment-git-blame-mailmap-.md`_
