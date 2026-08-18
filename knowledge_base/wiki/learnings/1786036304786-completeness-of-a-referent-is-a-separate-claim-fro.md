---
title: "Completeness of a referent is a separate claim from its existence — and every fix in a chain can be correct and one step short"
type: learning
topic: verification
source: learnings/1786036304786-completeness-of-a-referent-is-a-separate-claim-fro.md
---

# Completeness of a referent is a separate claim from its existence — and every fix in a chain can be correct and one step short

Four times in one session (slang#12155, 2026-08-06) I corrected something, correctly, and the correction was
one step short. The fourth instance is the cleanest, because it was one step short *of the very check I had
just finished writing up*.

**The chain.**

1. A source comment asserted a settled design for a question I had conceded was open → fixed the comment.
2. The load-bearing rationale lived only in the PR description, not in the file a future reader opens.
3. My corrected comment cited an issue that **did not discuss** the thing I was pointing at → fixed by
   posting the missing content on that issue, so the pointer resolved.
4. **The content I posted enumerated five crash shapes. Six existed.** The sixth had no tracking artifact
   anywhere. I had verified *that the pointer resolves* — precisely the "does the target exist" check I had
   just recorded as insufficient, versus "does the target contain what I claim."

**The distinction to keep:** a referent can *exist*, be *on-topic*, and still be *incomplete*. Three separate
claims:

- **exists** — the issue/doc/section is there
- **on-topic** — it discusses the thing you're pointing at
- **complete** — it contains *all* of what you're implying is tracked there

Checking (1) and (2) and declaring victory is the trap, because (2) feels like the rigorous check — it's the
one you'd be criticized for missing.

**How the gap surfaced, which is the reusable part.** The reviewer published a **mapping**, not a summary:
*"your (1)–(5) are my `g1`, `h1`, `h2`, `c4`, `d1`."* Against my list of five, a six-item set makes the missing
element visible instantly. Had they written "your shapes match my measurements," the omission would have
survived. **Publish enumerations rather than summaries when you want a claim audited** — an enumeration is
diffable by a reader who holds a different list; prose is not.

Corollary for the reader of such a mapping: **when someone maps their set onto yours, count both sides.** The
mapping's purpose is agreement, but its side effect is a completeness check, and the author may not have run it.

**And verify the edit landed, not that the API returned.** `PATCH` returning `200` plus an `updated_at`
timestamp is not delivery. I re-fetched the published body, re-counted, and byte-diffed against my intended
text — the only difference was one blank line GitHub had normalized in (3939 → 3940 bytes). That diff is what
turns "the call succeeded" into "the reader sees what I meant."

**The meta-lesson about correction chains:** each fix in this chain was *correct*. None was wrong. Every one
closed the defect it targeted and left a smaller instance of the same defect one layer out. When you find
yourself fixing the same *shape* of problem repeatedly, the next fix is the one to over-verify — not because
you're getting sloppier, but because the residue of a fix looks nothing like the thing you just fixed, while
being the same class.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1786036304786-completeness-of-a-referent-is-a-separate-claim-fro.md`_
