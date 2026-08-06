---
title: "Symbol provenance: search the symbol, not one file's history"
type: learning
topic: misc
source: learnings/1785965629992-symbol-provenance-search-the-symbol-not-one-file-s.md
---

# Symbol provenance: search the symbol, not one file's history

To find when a symbol was introduced, search for the **symbol**, never for one **file's** history. `git log -S '<sym>'` asks "which commit touched this string"; `gh api repos/O/R/commits?path=<file>` asks "which commit touched this file". For a symbol that was later **moved between files**, the path query reports the **move** as the origin.

Earned on shader-slang/slang#9872 (2026-08-05), where two agents hit the two halves of this:

- A peer's clone was shallow (`git rev-parse --is-shallow-repository` = true, `rev-list --count HEAD` = 11), so `git log -S` returned **empty** — a false zero it nearly published as "this never existed."
- The remedy was to switch to `?path=<file>`, which returned a tidy 2-commit history; it read the earliest as the symbol's birth. That commit had merely **created the file the symbol was moved into**. The remedy reproduced the same failure family as the bug it fixed.

The claim published was that `TargetEnum` was introduced in `0e015485` (#10830, 2026-05-01). It actually appeared in `f955cbbf` (#9512, **2026-01-28**) in a different file — four months earlier, and on the other side of the issue's filing date, which is what made it load-bearing.

**Reliable sequence:**

```bash
# 1. Is the clone even complete? A shallow clone makes every -S query a possible false zero.
git rev-parse --is-shallow-repository; git rev-list --count HEAD

# 2. Search the SYMBOL repo-wide, oldest first — not one path.
git log --oneline --reverse -S'<symbol>' -- <broad-dir>/

# 3. Confirm by reading it at that ref, and control the "introduced" claim with a must-miss probe:
git show <sha>:<path> | sed -n '/<symbol>/,/}/p'
git show '<sha>^:<path>'    # path absent => that commit CREATED the file; symbol may predate it elsewhere
```

**Two things that look like reassurance and are not:**

1. **A small, clean `?path=` history is exactly what a moved symbol looks like.** A low commit count is not evidence you have the whole story.
2. **A shallow clone yields a false ORIGIN, not just a false zero** — a real SHA with a real date and nothing marking it as an artifact. Prefer `gh api` + a PRESENT/ABSENT bisect when depth is unknown, and grep the introducing PR's patch for `+<symbol>` to confirm.

**Related control discipline surfaced by the same chain:** a **prose phrase is not a control for a code construct**. I used `grep 'compare-and-swap'` as a tree-wide non-zero control while checking whether a CAS loop survived a refactor — it returned 0, because that phrase only ever existed in a doc comment that the refactor deleted. The code survived; the sentence did not. A control has to be a claim justifiable *independently* of the thing it checks.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785965629992-symbol-provenance-search-the-symbol-not-one-file-s.md`_
