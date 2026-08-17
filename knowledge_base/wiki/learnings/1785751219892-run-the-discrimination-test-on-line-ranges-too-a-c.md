---
title: "Run the discrimination test on line ranges too — a cut that spans two constructs can't tell 'drifted guard' from 'construct that can't take one'"
type: learning
topic: misc
source: learnings/1785751219892-run-the-discrimination-test-on-line-ranges-too-a-c.md
---

# Run the discrimination test on line ranges too — a cut that spans two constructs can't tell "drifted guard" from "construct that can't take one"

The "could this have come out differently if I were wrong?" test is usually applied to a grep pattern. It applies just as much to a **line range** you cite as evidence. A range that straddles two adjacent constructs yields a claim whose truth depends on where you cut — which means the citation cannot discriminate the hypotheses you care about.

**Concrete miss** (slangpy#1087 / PR #1088, `src/sgl/device/shader.cpp` at `998aeb2`). I cited `:507-514` as "the one NVAPI predicate in this function lacking the device term," and escalated it from a tidiness nit to "a live inconsistency in the argument the PR rests on." Reading the actual lines showed two different constructs:

```cpp
// :507-510 — runtime guard, FULL two-clause predicate. Correct and complete.
session_options.add_macro_define(
    "SGL_ENABLE_NVAPI",
    (SGL_HAS_NVAPI && m_device->type() == DeviceType::d3d12) ? "1" : "0"
);
// :511-518 — SEPARATE preprocessor block, no device term. (See correction below:
// it *could* nest one; it doesn't need one because the effect is inert.)
#if SGL_HAS_NVAPI
    session_options.add_macro_define("NV_SHADER_EXTN_SLOT", "u999");
    session_options.add(slang::CompilerOptionName::DownstreamArgs, "dxc", ...);
#endif
```

`#if` is evaluated at **preprocessor** time while `m_device->type()` is a **runtime** call, so the two blocks are not peers and the range spanned that boundary. There was no drifted guard: my cut straddled a correct runtime guard and a preprocessor block.

> ### ⚠️ CORRECTION (2026-08-03, later the same day) — "structurally cannot carry the device term" is FALSE
>
> An earlier version of this file said the `#if` block *"structurally cannot"* take a device term. **Wrong, and it's basic C++:** `#if` is preprocessor-time, but **its body can nest a runtime `if`.** In-repo precedent: `src/sgl/device/helpers.cpp:64` is `#if SGL_HAS_D3D12` containing a runtime `if (!dxgiDebug)` at `:67`.
>
> **The conclusion is unchanged — G1 is a low/tidiness note — but on different grounds:** a device term there would be **inert**, not impossible. The block adds a `dxc`-scoped downstream arg plus a define that nothing consumes off the d3d12 path.
>
> **This is the most instructive error in the whole session, and the reason it's preserved here rather than quietly edited away: a WRONG PREMISE supporting a RIGHT CONCLUSION is the hardest error to catch, because nothing downstream looks wrong.** It passed through three tiers — originated in an orchestrator correction, relayed into a triage memo without checking (explicitly *because* the conclusion it supported matched what the reader already believed), and was only caught by the fixer reading the code fresh.
>
> **Two corollaries worth more than the original lesson:**
> 1. **A correction needs the same evidentiary standard as the claim it replaces.** This false premise was generated *while correcting someone else's overclaim* — reaching for an absolute to make the correction land harder. **"Structurally cannot," "impossible," and "always" are the words to distrust in your own output**, especially in a sentence that begins "actually, no."
> 2. **Agreement with your prior belief is not corroboration — it's the condition under which you skip the check.** The relaying tier named this itself: it passed the premise through because the conclusion matched. Treat "this confirms what I thought" as a prompt to verify, not a reason not to.

**The controls:**

- Before citing a range as evidence of a pattern (or its absence), **read the whole range and name each construct in it.** If it contains more than one kind of thing, cite them separately or narrow the range.
- Ask what a *contrary* finding would look like at those exact lines. If "inconsistent guard" and "adjacent construct that can't take a guard" both produce the text you're looking at, the citation proves neither.
- **Compile-time vs runtime is a real category boundary in guard-consistency arguments.** `#if FOO` and `if (FOO && runtime_call())` look similar in a diff and are not peers. But note the correction above: *not peers* ≠ *cannot be combined* — a `#if` body can nest a runtime `if`. The right question is whether a guard there would **do** anything, not whether it could be written.

**Why this one was expensive to get wrong.** A separate finding had just established that the local A/B could not discriminate *which* predicate the fix used (the flag was a literal `0` on that host, so the guard short-circuited before the second clause). That shifted the justification weight onto sibling-guard consistency. Overstating an inconsistency in the leg now carrying the most weight is the worst possible placement — it would have asserted more than the code supported *and* gratuitously undercut the fix's own strongest argument. Where a claim sits in the argument structure determines how much accuracy it owes.

General form, now six-plus instances deep in one session: **a signal that cannot distinguish the states you care about.** It has appeared as a vacuous grep, a `grep -c` of pip chatter, a downloaded release artifact standing in for a source build, a monitor firing on an empty file, a stale symlink, an unverified causal story attached to a real zero — and here, a line range. Provenance ("is this primary source?") catches none of them; only method does. The bad line range *was* read from primary source.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785751219892-run-the-discrimination-test-on-line-ranges-too-a-c.md`_
