---
title: "decline credit you did not earn misattributed correction corrupts provenance same as unattributed borrow"
type: learning
topic: verification
source: learnings/1785780007458-decline-credit-you-did-not-earn-misattributed-corr.md
---

# decline credit you did not earn misattributed correction corrupts provenance same as unattributed borrow

# Decline credit you didn't earn — misattributed credit corrupts provenance too

**Observed 2026-08-03, slang-rhi#800/#801 (Main ↔ slang-pr-approver).** After a long
mutual-correction exchange, the approver thanked me for two specific corrections:
*"your 207-rows correction"* and *"your (b) retraction"* about log print order.

**I had sent neither.** Both were self-corrections on its own side that had also
landed in my memory row (via editor/linter writes), so from its vantage they looked
like mine. The easy move was to accept the thanks — the facts were correct, the
outcome was right, and disclaiming costs a round trip.

That would have been a provenance error, and the numbers involved now sit in a
**shared canonical file** other agents will cite. An audit later asking "who
established 207 registered / 0 executed, and against which artifact?" would have
resolved to the wrong tier.

## The rule

**Accepting credit you didn't earn corrupts the audit trail exactly as badly as
presenting someone else's finding as your own.** The well-known failure is the
unattributed borrow; this is its mirror image and it is *harder* to catch, because
the incentive runs toward silence — correcting it makes you look worse, not better.

When a peer credits you for something:
1. Check whether you actually sent it. Grep your own outbound record, not your
   memory of the exchange — shared files can carry text you never authored (linters,
   hooks, another tier's edits landing in your row).
2. If you didn't send it, say so plainly and name who did.
3. **Verify the substance independently anyway** — a misattributed fact can still be
   true, and confirming it is cheap. Report the split explicitly: *facts verified by
   me, authorship theirs.*

Here the substance held: `grep -c '\.metal'` = **209** total rows,
`\.metal[[:space:]]+SKIPPED` = **207**, `(PASSED|FAILED)` = **0** — so "207
registered, 0 executed" is right, and the paired form matters (a single-space
pattern against a column-padded log matched nothing, which is a fact about the
regex, not the world). Likewise the print-order point: the `[Info]` line sits
*after* the verdict line because `debugCallbackOutput` is flushed only once
`RETURN_NOT_AVAILABLE` has decided to bail ⇒ **never cite log print order as
evidence of emission order when the logging path buffers.**

## Companion measurement rule

Before believing any zero, run a **broader control grep that must be non-zero**. And
when reporting coverage, always give the pair **"N registered, M executed"** —
`GPU_TEST_CASE` registers a row per flagged device whether or not the device exists,
so collapsing the two lets someone eventually cite 207 skipped rows as coverage.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785780007458-decline-credit-you-did-not-earn-misattributed-corr.md`_
