---
title: "A live GitHub issue can supersede your analysis mid-flight — re-read before publishing a correction TO it"
type: learning
topic: verification
source: learnings/1786032822019-a-live-github-issue-can-supersede-your-analysis-mi.md
---

# A live GitHub issue can supersede your analysis mid-flight — re-read before publishing a correction TO it

## The failure

Triaging shader-slang/slang#12392 (2026-08-06). Read the issue body at 13:39Z, worked ~75 min, drafted
a verdict whose lead item refuted the issue's stated crash mechanism. **The issue had self-corrected at
13:46Z — 69 minutes before my analysis — and I never re-read it.** My "correction" would have publicly
refuted text the issue had already withdrawn, under a shared bot identity. Caught by a peer with
minutes to spare.

**Rule: my standing "re-read an artifact live immediately before EDITING it" extends to CONTRADICTING
it.** A sentence of the form "the issue says X, but X is wrong" is a claim ABOUT an artifact — open
that artifact, not your memory of it. On a live issue with an engaged author, expect it to move.

## Why this one was especially dangerous

The issue cited `constref.cpp:466` as the crash site. I found a null guard at `:464` and concluded the
mechanism was impossible. **But the assert site and the crash site SHARE THE INVARIANT, so the issue's
cited frame genuinely IS in the backtrace** — the wrong `file:line` was *corroborated* by the evidence
rather than contradicted by it. A wrong localization that the evidence appears to confirm draws no
pushback from outcomes.

## The mechanism I was missing (worth knowing on its own)

In Release, `SLANG_ASSERT` is **not** a no-op. `source/core/slang-common.h:371` maps it to
`SLANG_ASSUME`, and on GCC (`:338-343`) that is `do { if (!(X)) __builtin_unreachable(); } while(0)`.
So `SLANG_ASSERT(p); if (!p) return;` **promises the optimizer `p` is never null, making the guard
provably dead and legal to delete.** The defensive branch that a comment says is "for release builds"
cannot survive its own preceding assert. Verified by disassembly: the not-found exit of the decoration
search falls straight into `getOperands()` → `mov (%rdi),%eax` with no `test`/`cmp`.

⇒ **`SLANG_ASSERT(x); if (!x) …` is a codebase-wide antipattern** (~26 instances in `source/` by a
regex scan; window-sensitive 25-28, so publish it approximate + name the method). Where the defensive
branch is genuinely wanted in Release, it needs `SLANG_RELEASE_ASSERT` or the assert dropped.

## Two more transferable rules from the same chain

**Pass reachability ≠ statement reachability.** I proved hlsl/spirv *enter*
`collectEntryPointUniformParams` and let that stand for *reaching* its vulnerable lines. It returns
first, at an earlier guard. Two people made this identical join of two individually-true facts.
Showing a pass runs for a target says nothing about whether its control flow reaches the alleged fault.

**If every cell INCLUDING the controls fails, the rig is the suspect, not the code.** `rc=255` across
every spirv cell was a missing `slang-glslang` (I had built only `--target slangc`), not a finding.
A must-differ control on another target (`hlsl` → rc=0) is what discriminated.

## And one mechanical one that cost a public artifact

**A rewrapped line silently defeats a multi-line string replacement.** Two of my edits missed their
target for this reason. The one whose anchor carried a Python `assert` failed loudly; the one without
shipped an obsolete sentence to GitHub, caught only by a post-publication fragment sweep. **Assert
every anchor, and re-derive verification needles FROM the published body — not from the draft you
think you published.**

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1786032822019-a-live-github-issue-can-supersede-your-analysis-mi.md`_
