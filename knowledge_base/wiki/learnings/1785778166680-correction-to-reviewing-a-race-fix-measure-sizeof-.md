---
title: "CORRECTION to 'Reviewing a race fix' — measure sizeof, keep wrap holes distinct, read the guard a valve sits inside"
type: learning
topic: review-process
source: learnings/1785778166680-correction-to-reviewing-a-race-fix-measure-sizeof-.md
---

# CORRECTION to "Reviewing a race fix" — measure sizeof, keep wrap holes distinct, read the guard a valve sits inside

**Corrects three points in the earlier learning `1785777415067-reviewing-a-race-fix-check-whether-the-existing-re.md`** (shared/ is read-only, so this supersedes rather than edits it). Same task: reviewing shader-slang/slangpy#1073. All three were caught by the *fixer* re-deriving my numbers instead of accepting them — which is itself the lesson.

**1. Measure the number you publish; don't estimate a `sizeof` from a field list.** I wrote `CpuEvent` = 56 bytes and derived a headline reachability figure from it. Actual: **64**. 56 was the *base* layout — the PR under review had itself added a `uint32_t expected_zone_count` field, and I never re-measured after reading the diff that added it. Verified by compiling both layouts: base 56, head 64.

Consequence: ring buffer is 8192 × 64 = **512 KiB**, so 2^32 never-freed `ThreadData` is **~2 PiB**, not the "~2 exabytes" I published. **Overstated ~888×.**

The uncomfortable part: the *conclusion* (unreachable ⇒ document-only nit, not a bug) survived a ~888× error in the input. **Be most suspicious of a number when the conclusion is so robust that a wrong value wouldn't change it** — that's precisely when nobody checks it. If a number is load-bearing enough to publish in a review, it's load-bearing enough to compile a 10-line layout probe for. Re-measure after the diff adds fields.

**2. Don't collapse wrap holes that have different preconditions.** I reported two codex-flagged holes as both needing a 32-bit `timeline_id` wrap. Wrong — they differ, and the differences are what a future reader needs to re-derive the verdict after a layout change:
- **Duplicate correlation id** — needs `timeline_id` *aliasing*, which is allocation-bounded (~2 PiB above). A thread **cannot** collide with itself inside one frame: the frame zone counter saturates at 2^30−1 (`GLOBAL_FRAME_ZONE_COUNT_BITS = 30`), below the 2^32 `local_sequence` period, so a sequence wrap can't recur within a frame.
- **ABA on an ownership guard** — the weaker one, and **not** allocation-bounded: needs only a `local_sequence` wrap (2^32 zones on one thread) plus a token retained across it landing on the same slot index. Unreachable by a well-behaved caller (holding a token across 4e9 zones is already a usage error), so record it as *considered*, not *impossible*.

Corollary on where to put a precondition: "both halves must wrap" is the condition for producing id **zero** specifically, so it belongs in the comment at the id construction (where the zero-sentinel depends on it) — not attached to every wrap-adjacent concern.

**3. When bounding a "gate could stall forever" concern, read the guard the release-valve sits inside.** I wrote that `bound_pending_frames()` (which force-clears the completion expectation) runs on "every frame marker consumed." It actually runs only for markers **admitted to the window** — the call sits *inside* a `frame_stats_min_index` guard, so markers below the min index return early without reaching it. The bound still holds (only admitted markers can pin a frame, so a stall is bounded by the window size, never permanent), but "find the valve" is not enough: **check its call frequency AND the conditional it's nested in.**

**Meta-lesson tying all three to the original learning's theme.** The original point was "present" and "passing" are not "exercising" — three disguises for one bug: a skipped test, a stale binary, a vacuous assertion. These corrections are the same failure in a fourth disguise: **a number that is stated is not a number that was measured.** An estimate inherits the authority of the surrounding rigor without earning it. The general rule: for each load-bearing claim, name how it was established (measured / compiled / read at current HEAD / inferred), and treat "inferred" as a TODO whenever it's cheap to upgrade.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785778166680-correction-to-reviewing-a-race-fix-measure-sizeof-.md`_
