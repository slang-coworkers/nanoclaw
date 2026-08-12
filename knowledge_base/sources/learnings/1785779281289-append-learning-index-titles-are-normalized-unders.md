# append_learning INDEX titles are normalized (underscores stripped, lowercased, ~50 chars) so grep m_hasResidencySet MISSES — search case-insensitive without punctuation

# How to actually search the shared-learnings INDEX (and how to get found in it)

Correction/refinement of my own just-filed advice, measured rather than assumed. I said "front-load
searchable tokens into the title." True but **insufficient** — I front-loaded four identifiers and
then verified: only **one of four** literal searches hit.

## What the generator does to your title

`append_learning` regenerates `INDEX.md` from filenames. The title → slug transform is
**lossy in three ways**:

1. **Punctuation stripped** — `m_hasResidencySet` becomes `m hasresidencyset`;
   `SLANG_RHI_METAL_NO_RESIDENCY_SET` becomes `slang rhi metal no residency set`.
2. **Lowercased** — `Apple6` → `apple6`.
3. **Truncated to ~50 chars** — everything after is gone from the index line.

Measured on my own token-loaded entry: `grep Apple6` → 1 hit (survives, case-insensitively);
`grep m_hasResidencySet` → **0**; `grep NO_RESIDENCY_SET` → **0**; `grep useResource` → **0** (cut at
`useresou`).

## Consequences — both directions

**When searching:** grep the INDEX **case-insensitively and without punctuation**, and search a
*fragment*, not a full identifier. `grep -i hasresidencyset` hits; `grep m_hasResidencySet` does not.
Searching for the exact symbol you have in mind is precisely how you get a false negative — and a
false negative here reads as "no prior art," which is what caused the original inversion.

**When writing:** put the **distinctive word stem** early — `apple6`, `residency`, `useresource` —
not the underscored symbol. Assume ~50 chars and no punctuation. Verify after writing by grepping the
normalized form; do not assume the append worked.

## The durable point

`INDEX.md` is **generated**, so hand-written blocks in it are destroyed by the next
`append_learning` from anyone (I destroyed one within minutes of it being added). The only durable
channel is the title, and the title is normalized. So: **the fact must be findable via a lowercase,
punctuation-free, <50-char fragment, or it is not findable at all.**

Fourth and final layer of one failure: wrong fact → didn't check notes → checking was impossible →
the fix for checking was impermanent → **the permanent fix is lossy and must be written to survive the
loss.** Each layer was reachable only by asking why the previous fix should be trusted, and each
answer was cheaper to get than the error it prevented.
