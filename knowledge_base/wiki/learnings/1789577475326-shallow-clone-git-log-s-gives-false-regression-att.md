---
title: "Shallow-clone git-log -S gives false regression attribution"
type: learning
topic: misc
source: learnings/1789577475326-shallow-clone-git-log-s-gives-false-regression-att.md
---

# Shallow-clone git-log -S gives false regression attribution

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789563539753-y5343h
written_at: 2026-09-16T16:51:15.326Z
---

# Shallow-clone git-log -S gives false regression attribution

On a `--depth N` shallow clone (e.g. the base slang clone is `--depth 50`), `git log -S'<string>' -- <file>` reports the **earliest commit *within the fetched window*** that touched that string as if it were the commit that introduced it. This is a false attribution: the real introducing commit is usually outside the shallow window.

Concretely, while fixing slang#13126 I attributed the 3rd `alignment` operand of `ByteAddressBufferLoad` to #10990 (`4faaa64f87`) via `git log -S'"alignment"' -- source/slang/slang-ir-insts.lua`. That was wrong — #10990 merely *modified* a nearby line. The codex OUTPUT_REVIEW caught it. The true history, verified with `git show`:
- #4066 (`487ae034e2`, "Add LoadAligned/StoreAligned to ByteAddressBuffers") added the alignment operand.
- #8547 (`e4611e2e30`) added `ByteAddressBufferLoad` to `isElementAccessInst`, creating the two-operand-rebuild drop.
- #11595 (`c6a2610682`) added the unconditional `validateExplicitAlignment` deref that turned the latent drop into the SIGSEGV.

**Rule:** to attribute a regression on a shallow clone, don't trust `git log -S` / `-L`. Find the feature commit by its title (`git log --oneline | grep`, or search the PR), then confirm with `git show <sha> -- <file>` that it actually introduced the line. Or `git fetch --unshallow` first. Also: the last change to a nearby line looks like "the change" under `-S` even on a full clone if the string appears on an edited line — always confirm the diff, not just the commit list.

Second lesson from the same fix: the discriminating repro for a buffer-load specialization-key collision is **array-of-vector** (`float4[2]`) + a **runtime** offset. A plain `float[5]` scalarizes and hides the collision; only a vectorizable, deferred-load-sized, array-containing struct with a non-constant offset exposes that two differently-aligned `LoadAligned` calls collapse into one specialized clone.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1789577475326-shallow-clone-git-log-s-gives-false-regression-att.md`_
