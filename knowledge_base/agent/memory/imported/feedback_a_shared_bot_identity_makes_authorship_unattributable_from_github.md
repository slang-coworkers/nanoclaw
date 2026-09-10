---
name: feedback_a_shared_bot_identity_makes_authorship_unattributable_from_github
description: "Every coworker posts as nv-slang-bot[bot], so GitHub cannot tell you WHICH session wrote a comment — and a peer holding a stale premise keeps posting under your chain's identity. Attribute via `ncl sessions list` thread+last_active bracketing, not comment ids."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: dc370b43-6b29-4d6b-87b0-231e0389495a
---

# GitHub shows one author for N coworkers — attribute from the session table, not the comment

**MEASURED 2026-08-06, slang#12392 / slangpy#820.** `slangpy-triager` reported: *"a sibling session
under our shared bot identity posted two #820 comments today (13:40, 13:46) I had no record of"* — and
flagged the worst one, `5205392718`, which told a **human maintainer (@ccummingsNV)** to *"scope the fix
to `[shader("compute")]` rather than assuming both tags misbehave."* That is the retracted narrowing;
acting on it would have shipped a fix **leaving the Vulkan `[CUDAKernel]` crash path live**.

## The mechanism

Every coworker in this fleet posts as **`nv-slang-bot[bot]`**. So:

- `author` on a comment identifies the **fleet**, not the **session**. Two sessions disagreeing look
  like one bot contradicting itself.
- A peer who was briefed with a since-retracted premise **keeps publishing under the same identity**
  after the retraction reaches you. Your correction does not reach their session by being true.
- ⛔ **Comment-id-based bookkeeping ("I patched `5197942798` and `5197987080`") silently defines its
  own coverage** — it enumerates the artifacts *you know about*. The highest-consequence carrier here
  was one **neither** of us had in our list. Same failure shape as
  [[feedback_publish_a_claim_as_wide_as_your_evidence]]: a list that looks like an enumeration.

## ✅ The attribution instrument that works

Don't try to attribute from GitHub. Use the session table and bracket by thread + `last_active`:

```
ncl sessions list --limit 2000            # then filter by thread_id and last_active window
ncl groups list                           # map ag-<id> -> coworker name (groups get --id printed NOTHING for name/folder)
```

Measured for this case: three sessions carried `gh-issue-shader-slang/slang-12392`
(mine 13:39, `slang-triager` 13:42, `slangpy-triager` 15:01) — **but the #820 poster was on a different
thread entirely**: `sess-1785960037994-0ab791`, agent group `ag-1780667172530-ht5rv2` =
**`slangpy-fixer`**, thread `gh-issue-shader-slang/slangpy-768`, `last_active 13:49` — bracketing the
13:40/13:46 comments.

⭐⭐⭐ **The stale-premise holder was on the SIBLING thread, not the thread under discussion.** Searching
`--limit 2000 | grep 12392` would have found three innocent sessions and missed the culprit entirely.
⇒ **When a retraction matters, enumerate every session touching the ISSUE FAMILY (parent + child +
PR threads), not the one thread you are on.**

⚠️ **Instrument note:** `ncl groups get --id <ag-…>` printed **nothing** for `name`/`folder` on all four
ids I tried (exit 0, empty) — a silent empty result, not an error. `ncl groups list` and matching the
id column works. Don't read the empty `get` as "group has no name."

## How to apply

- ⭐⭐ **Before believing a chain's GitHub footprint is corrected, list sessions across the issue
  family and ask which OTHER coworker was briefed with the retracted claim.** A retraction has to be
  *delivered per-session*; it does not propagate by being posted.
- ⭐⭐ **The blast radius of a stale premise is largest when it is addressed to a human**, because
  humans act once and don't re-read. Prioritize correcting maintainer-directed comments over
  bot-to-bot ones.
- ⭐ Route the correction to the **owner of that surface** (slang repo → `slang-triager`; slangpy →
  `slangpy-triager`/`slangpy-fixer`), not to whoever reported the drift.
- ✅ The catch came from a peer noticing an artifact *it had no record of writing*. **"I don't remember
  posting this under my own identity" is a signal to enumerate, not to dismiss.**

## ✅ OUTCOME (same day, 15:40-15:42Z) — the routing worked, and one prior got corrected

Messaged `slangpy-fixer` directly at its session on the `slangpy-768` thread. It **reproduced the
matrix in its own environment before publishing** (`507b4cf1`, L40S: `[CUDAKernel]` → CUDA rc=0 /
**Vulkan rc=139**; `[shader("compute")]` → rc=139 both, 3/3 on both contested cells), then posted
corrections on **both** surfaces — #820 `5207063742` and **#12392 `5207068960`**.

⭐⭐ **It also symbolized both Vulkan arms to check the Vulkan `[CUDAKernel]` crash was the SAME crash
rather than a second one** (frames byte-identical: `shouldTransformParam` → `IRUse::get()` via
`compileShaders` → `getEntryPointCodeFromShaderCache`) — *"precisely because a shared trigger shape
misled me once already today."* **A shared trigger shape does not imply a shared fault.**

⚠️ **Two structural notes worth more than the fix:**

1. ⭐⭐⭐ **A scope-NARROWING claim is the most expensive kind to get wrong, because it tells a
   maintainer what NOT to fix — and non-action leaves no failure signature.** The fixer named this
   itself: its other two retractions cost a re-read; this one would have cost working code. Same
   no-signature class as [[feedback_published_negative_env_claims_need_rederivation]].
   ⇒ **When the matrix is incomplete, prefer OVER-scoping.**
2. ⛔ **`slangpy-triager` corrected a prior of its OWN in the opposite direction:** it had assumed the
   unremembered comments were a **past session of itself** (self-forgetting). They were a **peer**.
   ⭐⭐ **That distinction changes the remedy — a peer needs a MESSAGE, a forgotten self-session needs a
   memory edit.** Misdiagnosing "who wrote this under our shared identity" silently picks the wrong
   fix, and the memory-edit remedy would have left the peer still holding the stale premise.

⚠️ **And the routing did NOT determine the actor:** I assigned the slang-repo corrections to
`slang-triager`; `slangpy-fixer` posted them first. No harm here, but **an assignment is not a lock** —
re-fetch before assuming your routed item is still unclaimed, or two coworkers correct the same line.

Related: [[feedback_a_caveat_that_names_the_confound_does_not_license_the_conclusion]] (the retracted
premise itself), [[feedback_a_correction_on_the_epic_does_not_reach_the_child_issue]] (per-artifact
patching relocates divergence rather than removing it).
