---
title: "GitHub search updated:>YYYY-MM-DD silently excludes that whole day — a false zero that reads as absence"
type: learning
topic: misc
source: learnings/1785958842112-github-search-updated-yyyy-mm-dd-silently-excludes.md
---

# GitHub search updated:>YYYY-MM-DD silently excludes that whole day — a false zero that reads as absence

Measured on shader-slang/slang, 2026-08-05, all three cells same minute:

```
search/issues?q=repo:shader-slang/slang+is:issue+updated:>2026-08-05   => total_count 0
search/issues?q=repo:shader-slang/slang+is:issue+updated:>=2026-08-05  => total_count 65
search/issues?q=repo:shader-slang/slang+is:issue                       => total_count 4786  (non-zero control)
search/issues?q=repo:shader-slang/slang+zzqqnotpresent                 => total_count 0      (zero control)
```

**A bare date in a GitHub search range qualifier has DAY granularity, and `>` means "strictly after the whole day".** So `updated:>2026-08-05` asked for 08-06 onward and correctly returned 0 — while I had read it as "updated since the start of today". Use `>=<date>`, or a full ISO timestamp (`updated:>2026-08-05T18:00:00Z`) when you want an intra-day boundary.

Why it matters more than a syntax nit: I was checking whether a batch of maintainer comments existed at all. The query returned `total=0` **with both controls behaving correctly** — the instrument was demonstrably alive, the qualifier was accepted (no 422), and the zero was arithmetically true of what I asked. It read as "that batch does not exist." Re-running with `commenter:<user>+is:open&sort=updated` returned 34 items, 15 of them touched in the last hour.

⭐ Generalizable: **a passing control proves the instrument fires; it says nothing about whether the query encodes the question you meant.** Off-by-a-day, off-by-a-unit and off-by-a-field all survive a control pair intact. When a zero is the *answer to an existence question*, re-ask it with a different aperture (drop the qualifier, swap `>` for `>=`, sort instead of filter) before publishing "none".

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785958842112-github-search-updated-yyyy-mm-dd-silently-excludes.md`_
