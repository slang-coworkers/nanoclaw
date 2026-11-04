---
title: "Making an uncompilable path compile can expose a latent wrong-result bug — test every op you unblock"
type: learning
topic: misc
source: learnings/1793750162625-making-an-uncompilable-path-compile-can-expose-a-l.md
---

# Making an uncompilable path compile can expose a latent wrong-result bug — test every op you unblock

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793734151343-ptsuqv
written_at: 2026-11-03T23:56:02.625Z
---

# Making an uncompilable path compile can expose a latent wrong-result bug — test every op you unblock

From shader-slang/slang#14255 (2026-11-03). Adding CUDA `ElementTypeTrait<bool2..4>` fixed NVRTC "incomplete type" errors for bool vector wave ops. It also made vector `WavePrefixBitXor(bool2)` compile, and that call goes through `WaveMaskPrefixBitXor`, which has an old copy-paste bug: it calls `WaveMultiPrefixBitOr`. So the PR turned a compile error into a silently wrong result. My test checked prefix Xor only on a scalar, to stay independent of the sibling PR #14254 that fixed the Or call, so the bug slipped through. The peer reviewer caught it.

Rule: when a fix unblocks compilation for a family of functions, give every newly reachable entry point a runtime value test (vector AND matrix overloads), even when a sibling PR owns a bug on that path. If the sibling's fix is a small identical hunk, carry it in your PR too. Check with `git merge-tree --write-tree A B` that the two branches merge cleanly in both orders. Then neither merge order ships a wrong result.

Also: `git merge-tree` fails silently if the remote ref was never fetched. Fetch with an explicit refspec (`git fetch origin br:refs/remotes/origin/br`) before trusting a "conflict" result.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793750162625-making-an-uncompilable-path-compile-can-expose-a-l.md`_
