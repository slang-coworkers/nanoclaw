---
title: "Synthesizing an index in a namespace another pass already allocates into: two authorities, no invariant — and the dup-check that misses it"
type: learning
topic: misc
source: learnings/1786034842355-synthesizing-an-index-in-a-namespace-another-pass-.md
---

# Synthesizing an index in a namespace another pass already allocates into: two authorities, no invariant — and the dup-check that misses it

A fix that eliminated three crash shapes and **reintroduced the same defect class on a fourth**, measured on
slang#12155 (2026-08-06). The pattern generalizes past compilers: any time you mint identifiers into a
namespace some other code path also mints into.

**Setup.** Unsemanticed shader output fields need a synthesized varying attribute. An existing pass derives
one from a **layout offset**. My producer-side fix synthesized one from a **private counter**, seeded past the
layout's field count to "avoid collisions."

**Result on the shape where both run:**

```
float4 a_0     [[color(0)]];
float4 b_0     [[user(_SLANG_ATTR_2)]];   ← existing pass, from layout offset
float4 extra_0 [[user(_SLANG_ATTR_2)]];   ← my counter
```

Two identical attributes, exit 0, no diagnostic — silently invalid output. Segfault → silent corruption, which
is exactly what the guard I was replacing did.

**The diagnosis that matters:** the bug wasn't the seed value. Tuning the counter cannot fix it, because
*nothing makes a count and a layout-derived offset agree* — their agreement would be a coincidence of the
input, not an invariant. **Two allocators over one namespace with no shared state is a design error, not a
constant to adjust.** The fix is one authority: derive your index the way the existing consumer does, or feed
a single allocator that sees every member.

**Before adding a synthesizer, ask: who else writes to this namespace?** Grep for the existing allocator
first. In my case one existed (`_returnNonOverlappingAttributeIndex` over a `std::set` of used indices) and I
hadn't looked.

⚠ **And an existing allocator may not be the answer either — check what it operates on.** Mine only
*re-indexed entries that already carried a value*; it never synthesized for a bare one. So "just feed the
existing allocator" was under-specified: my synthesized form had to also be *classified as overlapping* by its
collection pass, or the collision stays silent. Verify the mechanism's precondition, not just its existence.

**The verification trap, which is the reusable half.** I planned to check for duplicate **indices**. That check
was worthless, because the emitter suppressed the index when it was 0:

```cpp
if (semanticIndex > 0) { emit("_"); emit(semanticIndex); }   // index 0 → bare "_SLANG_ATTR"
```

So index `0` and *no index* render to the **same string**. A counter-level dup check passes while the output
has two identical attributes. **Check the emitted artifact's strings, not the values you generated** — the
rendering layer can collapse distinct inputs into identical output. Same family as "diff the artifact, don't
trust the exit code."

**Two process notes worth as much as the finding:**
- **A killed build can still leave a usable instrument.** I stopped a build mid-link, then found it had
  *already relinked the shared library* with my change. Rather than assume "killed ⇒ no measurement," I
  checked what the binary *contained* (via a discriminating output difference) and got the decisive `c4`
  result for free. Verify what your artifact holds; don't infer it from the build's fate.
- **State the instrument's limits when they're real.** Those results came from a partially-built tree, so I
  reported them as such and did *not* run regression suites on it — a sweep on an inconsistent build is a
  green that doesn't bind.

**Cite by symbol, not line number, when the reader may hold a different revision.** A reviewer reading `master`
sent me line numbers that landed inside my own inserted code (my diff shifted the file ~139 lines). Both of us
were "correct" for our own revision. This is the mirror of stale-citations-after-rebase: the *reader's* cites
failing to land rather than the author's.

**Derive execution order from call structure, not textual position.** I argued phase order from one line number
being greater than another; in a file where the driver is defined below its callees that proves nothing. The
sound derivation was the actual call sequence.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786034842355-synthesizing-an-index-in-a-namespace-another-pass-.md`_
