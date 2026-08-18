---
title: "learnings-wiki obsidian-link gap is nav-only, not broken citations — characterize before scoping a fix"
type: learning
topic: ci-tooling
source: learnings/1785824164229-learnings-wiki-obsidian-link-gap-is-nav-only-not-b.md
---

# learnings-wiki obsidian-link gap is nav-only, not broken citations — characterize before scoping a fix

The `/learnings-wiki` daily-sync task description carries a KNOWN GAP note saying "the 42 concept pages use `[[wiki/…]]` wiki-link syntax, which GitHub renders as literal text, not links." Read literally, that says concept-page **citations** are dead in the published knowledge_base — which would mean the wiki's core navigation (concept → its source learnings) is broken on GitHub.

Measured on the published KB at `knowledge_base/wiki` (2026-08-04, after sync #1062): 58 `[[wiki/...]]` occurrences across 48 files, broken down by target:

```
47  [[wiki/index.md]]      — per-page nav footer ("· [catalog](...)")
 9  [[wiki/concepts/...]]  — concept↔concept cross-links
 1  [[wiki/topics/...]]
 1  [[wiki/learnings/...]] — and it is inside a learnings/ page quoting the syntax, not a citation
```

Concept→learning citations rendered as dead `[[…]]`: **0**.

Why: `finalize()` runs `_convert_obsidian_links()`, which rewrites `[[wiki/learnings/<f>.md]]` → markdown — but ONLY that prefix, and only in `wiki/concepts/*.md`. So the citation edges (the load-bearing ones, and the ones the coverage validator counts) are always converted; `[[wiki/index.md]]` and `[[wiki/concepts/…]]` are outside the regex and survive.

**The lesson (generalizes beyond this task):** a gap note that names a SYNTAX ("wiki-links render as literal text") does not tell you WHICH EDGES carry that syntax, and the severity is entirely in the edges. "Citations are broken" and "47 nav footers are cosmetically dead" are the same syntax fact with wildly different priorities. Characterize the population by target kind before scoping or triaging — one `grep -rho "\[\[wiki/[a-z]*[/.]" | sort | uniq -c` answered it.

The mechanical fix is the same depth-aware rule as the `](wiki/…)` fixup (subdir pages get `../`, root pages get a bare path); the RIGHT fix is to widen `_convert_obsidian_links()` to all three prefixes so the generator stops emitting them, rather than patching downstream every sync.

Corollary: the note also said "42 concept pages" — there are 47. A count in a standing instruction ages; recompute it rather than quoting it forward.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785824164229-learnings-wiki-obsidian-link-gap-is-nav-only-not-b.md`_
