---
name: feedback-an-anchor-that-is-not-unique-is-not-an-anchor
description: Content anchors for programmatic edits must be asserted unique — a duplicated anchor silently writes to the wrong block; assert-then-write turns a mis-write into a loud stop
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6671f318-efeb-4b8d-8a33-d95b81cddb95
---

# An anchor that isn't unique isn't an anchor

**EVIDENCE BASE: observed twice on 2026-08-05 (slang#12366 chain) — once by the
triager on `CLAUDE.local.md`, once by me on this store's `MEMORY.md`.** Both times
the assert fired and prevented a wrong write.

## The pattern

When editing a growing file programmatically, address the edit by a **content
anchor** (never a line number — those go stale as the file grows). But a content
anchor has its own failure mode: **it can appear more than once.**

```python
old = "RE-OPEN only on a fresh substantive human comment."
assert s.count(old) == 1, s.count(old)   # <-- this line is the whole point
s = s.replace(old, new)
```

Both failures on 2026-08-05:

- **Triager, `CLAUDE.local.md`:** the anchored sentence appeared **twice** — once in
  the original park block, once in the re-opened block. Re-opening a chain *duplicates
  the very phrases you would anchor on*, because the second block restates the first.
  The assert refused rather than patching the stale block.
- **Me, `MEMORY.md`:** `assert s.count(old)==1` fired with **0** — the anchor was
  **line-wrapped** in the file, so my single-line search string matched nothing.
  Multi-line prose does not contain your one-line anchor.

## The rules

⭐⭐⭐**Assert the anchor's occurrence count BEFORE writing, and let it fail loudly.**
`count == 1` is the only safe case. `0` means the anchor is wrong (wrapping,
paraphrase, edited text); `≥2` means it is ambiguous and a blind `replace` hits the
wrong one — or, with a bare `.replace()`, **all** of them.

⛔**Never address a growing file by line number** — content anchors go stale,
duplicate anchors go ambiguous, and only the assert distinguishes those from success.

⚠️**Beware the reflex to "fix" a failing assert by loosening it.** Widening to
`replace(..., count=1)` or dropping the assert converts a loud stop back into the
silent mis-write it was protecting against. **Locate the real text instead**
(`grep -n` the distinctive fragment) and re-anchor.

⚠️**Line-wrapped prose:** anchor on a fragment that cannot straddle a newline, or
`grep -n` first to see the actual wrapping. A long sentence in a hard-wrapped file
is *never* a valid single-line anchor.

⭐**Re-opened / restated blocks are the highest-risk case for duplication** — a
"CLOSED"/"RE-OPENED" section deliberately echoes the original's wording, so the exact
phrase you reach for is exactly the one now present twice.

Companion to [[feedback_a_caveat_aimed_at_the_wrong_claim_reads_as_diligence]] —
both are about a write landing on the wrong target while looking correct.
