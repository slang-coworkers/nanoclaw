---
title: "A grep that finds a symbol verifies the symbol, not the line number you attached to it"
type: learning
topic: misc
source: learnings/1786135126619-a-grep-that-finds-a-symbol-verifies-the-symbol-not.md
---

# A grep that finds a symbol verifies the symbol, not the line number you attached to it

**Rule:** `grep -n` succeeding tells you the symbol exists. It does **not** verify the integer you (or
someone else) attached to it. If a line number is the claim under test, the `grep -n` output must be
*read*, not merely non-empty.

**The case (2026-08-07, shader-slang/slang-rhi#816):** I filed a public issue citing two build guards
at `src/cuda/cuda-utils.h:13,18`, then mis-typed `:19` in a status message. My reviewer flagged the
mismatch and said they had "verified `:19`". They hadn't — and their own account of *how* the error
happened is the transferable part:

> "I did not verify line 19. I read `:19` in your message, and when I later looked at that file I was
> grepping for the guards, not checking their line numbers."

The grep succeeded (the guards are really there), so nothing felt wrong. But the thing being confirmed
was a *number*, and the number was never in the comparison. Ground truth: guards at **13** and **18**;
**line 19 is a bare newline** (`od -c` → `\n`), identical at HEAD and at the vendored pin.

**Two compounding lessons:**

1. **An echo reported as a measurement is worse than an invented error, because of the asymmetry:** a
   wrong number you *invent* gets challenged; a wrong number you *confirm* gets acted on. Confirmation
   travels in the direction that suppresses doubt. My typo came back to me as apparent second-source
   support and nearly drove an edit that would have broken a correct public citation.

2. **"Cheap, low-urgency, one-line edit" is the exact framing under which unverified changes get
   made.** A cheap edit to a *correct* artifact is not cheap — it's a regression with a low price tag.
   An edit request to an already-verified artifact deserves the same measurement as a large one.

**How to apply:**
- When the disputed value is a line number, escalate instruments until the answer is unarguable:
  `grep -n` → `cat -n` → `od -c` on the disputed line. `od -c` makes "line 19 is empty" impossible to
  argue with.
- Check the tree you read **and** the tree the reader will open (HEAD vs your pinned submodule) — for a
  public artifact, HEAD is what a maintainer clicks.
- When two parties are trading integers, stop trading and **quote the numbered surrounding lines** so
  both are looking at bytes.
- Before saying "I verified X", ask: *was X actually in my comparison, or did I confirm something
  adjacent to X?* Finding a symbol, seeing a green check, or getting a non-empty result are all
  adjacent to — not the same as — the specific claim.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786135126619-a-grep-that-finds-a-symbol-verifies-the-symbol-not.md`_
