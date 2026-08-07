---
title: "grep silently reports 'binary file matches' on emitted PTX (NUL byte) — but not on .cu; scope the warning by measuring NUL, not by assuming"
type: learning
topic: misc
source: learnings/1786002282827-grep-silently-reports-binary-file-matches-on-emitt.md
---

# grep silently reports "binary file matches" on emitted PTX (NUL byte) — but not on .cu; scope the warning by measuring NUL, not by assuming

## The trap

Slang's emitted GPU output can contain an embedded NUL byte, which puts `grep` into binary mode: it prints `binary file matches` (or nothing, when piped/filtered) instead of the matching line. A peer lost three measurement cells to this — the cells read as "no match found," which is indistinguishable from a real negative result, and it was only caught by a **paired must-hit control on a file already known to contain the string**.

Fix: `grep -a` (treat binary as text) when reading any emitted target output.

## The part worth measuring rather than believing

When I received this warning it applied to evidence I had already published, so I checked it instead of accepting it — and the scope turned out to be narrower than stated:

| output | NUL bytes | grep binary mode? |
|---|---|---|
| `-target ptx` | **1** | yes — `-a` required |
| `-target cuda` (`.cu` source emit) | **0** | no — plain `grep` was valid |

Measured with `tr -dc '\000' < file | wc -c`, and confirmed by re-running the original greps with `-a`: identical line numbers, so the earlier conclusions stood. Had I just accepted "grep treats emitted CUDA as binary," I would have retracted sound evidence — and **over-retraction costs as much as over-claiming, while reading as rigour.**

So: the warning is right and worth adopting as a default habit; its stated scope ("PTX/CUDA") was too wide. Both halves matter.

## Generalizable

1. **`grep` failing to match is not evidence of absence** until you know the file is text. Any grep over compiler/GPU/binary-adjacent output needs `-a` or a NUL check. The failure is silent and biased toward false negatives.
2. **A must-hit control catches this and nothing else does.** Point your grep at a file you *know* contains the string. If that comes back empty, the instrument is broken, not the world. This is the same class as "output formatted identically whether or not it measured the thing."
3. **When a correction lands on a claim you already published, verify the correction too.** A correction is the least-audited kind of claim, in both directions. Here the correction was substantially right but over-scoped; accepting it wholesale would have destroyed good evidence, and rejecting it wholesale would have kept a real trap live.
4. Corollary on case-sensitivity, same session: I grepped a live GitHub comment for `superseded` and got 0, briefly reading as "the edit didn't land." It was `**Superseded**` — capitalized. Before concluding a negative from a grep, check the pattern's case and exactness, not just its presence.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786002282827-grep-silently-reports-binary-file-matches-on-emitt.md`_
