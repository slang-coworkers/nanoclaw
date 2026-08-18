---
title: "[approver/false-safe] #817 merged with my abstained bytes byte-identical — 5 abstain rows overruled, and the gap I held on was REAL but I never established it FIRES"
type: learning
topic: review-approval
source: learnings/1786347918704-approver-false-safe-817-merged-with-my-abstained-b.md
superseded_by: 1786348876090-approver-false-safe-retraction-of-my-own-817-false
---

# [approver/false-safe] #817 merged with my abstained bytes byte-identical — 5 abstain rows overruled, and the gap I held on was REAL but I never established it FIRES

## Outcome

shader-slang/slang-rhi#817 merged 2026-08-10T07:42:26Z by `skallweitNV`, who APPROVED
13 seconds earlier. I had recorded **five** consecutive `ABSTAIN_POLICY / OPEN_GAP` rows
across five heads. **All five are now joined as overruled.**

The decisive fact: the merged bytes are **byte-identical** to what I abstained on —
`src/vulkan/vk-surface.cpp` `bcdcece338ed` and `src/vulkan/vk-device.cpp` `73ef1ed20899`
on `main` after merge, the same blobs I reviewed across the last three heads. So this is
not "they fixed it and merged"; it is **the code I withheld on shipping unchanged**.

That makes it a false abstain, and by my own standing rule the join is the only
instrument that detects one.

## What I got right, and it wasn't enough

The finding itself was real and I still believe the source reading. At
`vk-surface.cpp:398-399` the default path strips `TextureUsage::CopyDestination` when
`!FormatSupport::CopyDestination`, and that flag is derived from
**`linearTilingFeatures`** (`vk-device.cpp:1668`→`:1672`) while the swapchain image is
**optimal**-tiled (`:1694`). Verified by enumerating every `UPDATE_FLAGS`: `ltf` appears
exactly once and feeds exactly two flags; every other image flag uses `otf`;
`VK_IMAGE_TILING_LINEAR` appears nowhere in the file. The strip is silent — zero
`printError` in that branch, against an `else` branch where every unsupported bit errors
loudly. Independently reached by the review tool and by a peer's separate checkout.

**None of that is what a merge decision turns on.** The maintainer merged anyway, which
tells me the question I never answered is the question that mattered.

## Root cause of the abstain being wrong

I established that the predicate **asks the wrong question**. I never established that
it **produces a wrong answer on any real configuration**. Those are different claims and
I spent five revisions on the first one.

The unclosed conjunction, in my own final words: a device would need (i) the
`TRANSFER_DST` optimal-vs-linear asymmetry on a selectable presentable format **and**
(ii) a surface advertising `VK_IMAGE_USAGE_TRANSFER_DST_BIT`. I got population-level
evidence for (i) — four presentable formats, optimal exceeding linear by
0.12–0.42pp — but could not establish that the two coverage pages counted the same
device population (they render 11 minutes apart), and I never measured (ii) at all.

**Severity, honestly stated even now:** the consequence is a *lost capability* on some
minority of devices, not corrupted output, and the strip leaves descriptor and image
mutually consistent. A maintainer looking at that trade — a possible narrow capability
downgrade versus blocking a fix for a real, demonstrated SRGB bug — merging is a
defensible call. **My abstain treated "I cannot rule this out" as "a human must look",
when the honest framing was "this is a narrow, low-severity, unmeasured risk on a change
that fixes a measured bug."** Those read very differently to whoever has to act.

## The rules this buys

- **"The code asks the wrong question" is a code-quality finding; "this misbehaves on a
  real configuration" is a merge-blocking finding.** Do not let five revisions of
  increasingly rigorous work on the first one substitute for one attempt at the second.
  Ask early: *if I fully prove my reading, does it change what a maintainer should do?*
- **An abstain must price severity, not just uncertainty.** `OPEN_GAP` on an unmeasured
  trigger for a *low-severity, safe-direction* failure is the profile most likely to be
  overruled — and correctly so. I wrote "strong end of OPEN_GAP" five times on the basis
  of *reachability and silence*, which are urgency, while the *severity* stayed
  low-and-unmeasured throughout. Urgency without severity is not a hold.
- **Weigh what the change fixes against what it might break.** This PR fixed a
  demonstrated bug (SRGB preferred formats meant `UnorderedAccess` was never advertised,
  so the debug layer rejected storage on formats that genuinely support it). My rationale
  never put that benefit on the scale opposite my unmeasured risk. A verdict that only
  totals the risks will systematically under-approve.
- **Streak length is a signal about me, not the PR.** Five abstains on one PR across
  three byte-identical heads should have prompted *"is my bar wrong?"* rather than more
  re-keys. My store already records a 6-loss streak on this same repo as a standing bar
  defect; this is loss #7 and the same shape.

## Process notes worth keeping

- **The merge landed 7 seconds before my head probe**, mid-decision. I recorded the row
  anyway (the decision was genuinely derived from pre-merge state), flipped `mode` to
  `live_late` because a human review appeared *during* the pass, and disclosed the race
  rather than back-dating. A row describing pre-merge reasoning is still true; what
  changes is that the join is immediately available.
- **I stamped the human verdict on all five rows, not just the merged head.** Each was an
  abstain on the same bytes and each was overruled by the same merge; joining only the
  last one would have hidden four losses and made the scoreboard flatter than reality.
- The re-key discipline itself held up: blob identity as the switch (identical ⇒ re-key +
  fresh CI only; changed ⇒ full pass) kept cost bounded across heads 3–5. Cheap
  bookkeeping was never the problem here. **The bar was.**

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1786347918704-approver-false-safe-817-merged-with-my-abstained-b.md`_
