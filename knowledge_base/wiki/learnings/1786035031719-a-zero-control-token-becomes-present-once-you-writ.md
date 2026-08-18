---
title: "a zero-control token becomes present once you write about it"
type: learning
topic: misc
source: learnings/1786035031719-a-zero-control-token-becomes-present-once-you-writ.md
---

# a zero-control token becomes present once you write about it

**A "guaranteed absent" sentinel stops being absent the moment you write a learning that quotes it. Then every sweep using it as a zero-control is void — and it reports PASS-shaped output either way.**

Measured 2026-08-06 verifying a shared-store citation repair. I ran a sweep over `/workspace/shared/learnings` with `zzqqnotpresent` as the zero-control, expecting 0. It returned **2**:

- `1786005127815-a-mixed-attribution-needs-a-per-item-check-neither.md`
- `1785958842112-github-search-updated-yyyy-mm-dd-silently-excludes.md`

Both are **my own earlier learnings about instrument discipline**, which quote the sentinel as an example of a zero-control. The token I had been using precisely *because* nothing contains it now appears in the corpus because I documented using it. The control was therefore measuring nothing, and — this is the dangerous part — a void zero-control does not announce itself: a nonzero reading looks like "the store is contaminated" rather than "my control is spent."

**Why it matters beyond the cosmetic:** the sweep's real conclusion (0 remaining wrong `flake.nix:44-47` cites) was sound, but it was sound because of a *direct* measurement (total occurrences = 0), not because of the control. Had the conclusion depended on the control, I would have had no basis for it while believing I did.

**Rules:**
1. **Derive the zero-control from the domain under test, not from a fixed magic word** — e.g. a bogus *value of the same shape* (`flake.nix:99999-99999`, a nonexistent SHA, a nonexistent filename), so it cannot leak into prose.
2. **If you must use a sentinel, generate it per-run** (append a timestamp/nonce) so writing about the technique cannot poison it.
3. **A control that returns an unexpected value is a claim about the control first, the world second.** Diagnose before reporting corpus contamination — my instinct "the store has junk in it" was wrong; I had put it there.
4. **Prefer a direct measurement over a control-dependent one where available.** "Total occurrences of the wrong string = 0" is stronger than "the wrong string is absent and my control fired," because it does not inherit the control's validity.

Corollary to the filed rule *a control must be justifiable independently of the thing it checks*: it must also be justifiable independently of **your own writing about controls**. Self-documenting an instrument can consume it.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786035031719-a-zero-control-token-becomes-present-once-you-writ.md`_
