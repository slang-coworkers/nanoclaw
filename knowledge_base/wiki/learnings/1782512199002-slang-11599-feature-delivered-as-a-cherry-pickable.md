---
title: "slang #11599 — feature delivered as a cherry-pickable reference PR maintainer won't merge to ToT (CHANGES_REQUESTED = no-merge signal)"
type: learning
topic: slang-compiler
source: learnings/1782512199002-slang-11599-feature-delivered-as-a-cherry-pickable.md
---

# slang #11599 — feature delivered as a cherry-pickable reference PR maintainer won't merge to ToT (CHANGES_REQUESTED = no-merge signal)

## Outcome (final follow-up to the two earlier #11599 learnings)
The clip-space Z-remap feature (declined → reconsidered → green-lit narrowly) ended in a **non-standard but clean terminal state** worth recognizing in future chains:

**The arc:** jkwak-work first declined (out of scope), then on author pushback (glClipControl needs GL 4.5 / Vulkan needs `VK_EXT_depth_clip_control` — API fix not universal) reconsidered to a **narrow** scope (GLSL textual target, vertex stage only, `[-1..1]→[0..1]` i.e. `z'=(z+w)/2`), then explicitly @-mentioned the bot: "can you make PR ... when the users may want to cherry-pick and use?" → draft PR #11789 (`-fgl-remap-z`, `GLSLRemapZ=153`, gated `target==CodeGenTarget::GLSL && getEntryPointCount()==1 && stage==Vertex` — narrower than the invert-y `isKhronosTarget` precedent so SPIR-V is excluded).

**Two non-obvious patterns:**
1. **`CHANGES_REQUESTED` can be a "won't-merge-to-ToT" signal, NOT an edit request.** jkwak reviewed with state `CHANGES_REQUESTED` but body = *"Looks good to me. But we will not merge this to ToT, because this is just a one-off patch for anybody who wants to try out. Slang doesn't support the legacy behavior of GLSL."* with **zero inline comments**. Don't auto-interpret `CHANGES_REQUESTED` as "fixer must make code changes" — read the body. Here it means: patch accepted as correct, kept as a cherry-pickable reference PR, deliberately not merged. No code changes were owed.
2. **A maintainer can flip your draft PR to ready themselves — a non-draft state is NOT necessarily a gate violation by your side.** PR #11789 showed `isDraft:false` after creation though the fixer never ran `gh pr ready`. The `ready_for_review` timeline event actor was **jkwak-work** (the maintainer, flipping it to do his formal review). Before treating an unexpected non-draft state as an own-side gate breach, check `gh api repos/<repo>/issues/<pr>/timeline` for the `ready_for_review` actor.

**Observability handling:** when the maintainer states the disposition himself on the issue/PR AND a non-draft PR with `Closes #N` carries the trail, do NOT add a redundant terminal bot 5-bullet (noise). The existing draft-held artifact pointing at the PR + the maintainer's own words suffice. Issue/PR left open for the maintainer/author to close (never autonomously close).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782512199002-slang-11599-feature-delivered-as-a-cherry-pickable.md`_
