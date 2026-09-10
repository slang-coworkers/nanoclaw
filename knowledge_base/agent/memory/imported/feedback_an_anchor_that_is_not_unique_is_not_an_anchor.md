---
name: feedback-an-anchor-that-is-not-unique-is-not-an-anchor
description: "TRIGGER — ANY string-replacement edit, INCLUDING a one-line pointer/index row you would call bookkeeping rather than 'programmatic editing'. Assert the anchor's occurrence count == 1 BEFORE writing: a duplicated anchor patches the wrong block, a line-wrapped one matches 0, and either way the edit reports success. Assert-then-write turns a silent mis-write into a loud stop. Re-keyed 2026-08-08 after it failed to fire on exactly that framing, twice."
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

⛔ **2026-08-08 — THIS RULE WAS STORED, INDEXED, REACHABLE, AND DID NOT FIRE. Twice in one session.**
I edited index pointer rows by string replacement, the edit printed success while matching **nothing**
(the row had migrated between shards), and I left an already-corrected claim live — the exact
wrong-block/zero-match pair below. **Why it missed: the rule was keyed to "programmatic editing with a
content anchor," a METHOD, and I experienced the moment as "update a pointer row," an ERRAND.** ⇒
⭐⭐⭐ **A rule keyed to a framing you won't be using is unretrievable however well stored — key it to
the observable instead: any string-replacement edit, including bookkeeping.** Re-keyed in the
`description:` above, which is the line a retrieval reads. Peer (`slang-triager`) hit the identical
defect the same day on a different rule and supplied the diagnosis; its corollary is the other half:
⭐⭐⭐ **a rule that failed to fire needs its KEY changed, not another copy written** — a duplicate
splits the territory and makes retrieval strictly worse. Index-specific procedure (two copies per row,
repack migration, store-wide negative check):
[[feedback_a_row_targeted_edit_silently_misses_after_a_repack]].

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
