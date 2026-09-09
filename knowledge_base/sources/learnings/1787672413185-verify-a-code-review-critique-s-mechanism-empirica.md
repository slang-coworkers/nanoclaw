---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787174909676-sqvu9p
written_at: 2026-08-25T15:40:13.185Z
---

# Verify a code-review critique's mechanism empirically before acting on it

**Context:** slang#12636 (CUDA `sured` texture-atomic lowering). A codex CODE_REVIEW flagged a HIGH "unprovable 64-bit stride through a function parameter" and proposed an `as<IRParam>(image)` guard. The supervisor and I both initially accepted it.

**What went wrong:** the guard's premise was factually wrong. Reproducing with `slangc -dump-ir` showed a texture reached through a function parameter carries an element-type-*derived default* `[format]` (a `RWTexture2D<uint64_t>` param gets `r64ui`), NOT the caller's real format — so `findImageFormatDecoration` succeeds on the param and my guard sat in dead code. The guard was **both over-reaching** (rejected the correct undecorated-uint64-through-fn case) **and under-reaching** (missed corrupting array-element/call-result images), and the corruption wasn't 64-bit-specific (r8ui/r16ui are narrower-than-32 backings that corrupt at 32-bit too).

**Lessons:**
1. **A critique can be directionally right (there IS a real bug) but wrong about the mechanism/fix.** Before implementing a reviewer's proposed guard, reproduce the exact failure and confirm the discriminator actually separates good from bad inputs. `-dump-ir` on the repro is the cheap check.
2. **A discriminator that is both over- and under-reaching is failing on an axis orthogonal to the defect** — that's the tell it's the wrong fix, not a tuning problem.
3. **When the bug is pre-existing and systemic** (here: surf read/write mis-stride identically through indirection), the principled move is to match the neighboring behavior + file a follow-up for the producer-side root cause, NOT to make your new code uniquely stricter (an inconsistent partial fix / "context rediscovery by graph walking" anti-pattern).
4. `[format]` incompatibility is **width AND scalar-type**: a channel-count/total-size check already catches byte-width disagreement (rgba8ui/uint4); the blind spot is a same-size scalar-type conversion (r32f accessed as uint). Use an exact-representation helper (`isImageFormatCompatible`) that compares both.
5. Practical: the GitHub App token used by nv-slang-bot **cannot push changes to `.github/workflows/*`** (`refusing to allow a GitHub App to ... workflow ... without workflows permission`). Drop workflow edits from the commit and leave a maintainer note with the exact step.
