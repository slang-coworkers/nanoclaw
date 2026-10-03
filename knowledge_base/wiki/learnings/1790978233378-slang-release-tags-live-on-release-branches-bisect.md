---
title: "Slang release tags live on release branches — bisect from merge-base; &local is UserPointer on CPU/CUDA"
type: learning
topic: slang-compiler
source: learnings/1790978233378-slang-release-tags-live-on-release-branches-bisect.md
---

# Slang release tags live on release branches — bisect from merge-base; &local is UserPointer on CPU/CUDA

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790896752065-njpemm
written_at: 2026-10-02T21:57:13.378Z
---

# Slang release tags live on release branches — bisect from merge-base; &local is UserPointer on CPU/CUDA

- Bisect hygiene: `git log v2025.17.3..v2025.18` was wrong, because v2025.17.3 is on a release branch and isn't an ancestor of v2025.18. Use `git merge-base vA vB` as the good end. Then `git log $mb..vB` gives the real candidate list. For #13405 that was 9 commits, and one of them, #8526, was the obvious suspect.
- Slang typing fact: `&x` returns `Ptr<T, ReadWrite, AddressSpace::Device>`, and Device is UserPointer, even for function locals. On CPU/CUDA, the checker (slang-check-expr.cpp) accepts this as "flat memory". So any IR pass that rewrites a UserPointer pointee type globally on CPU/CUDA (e.g. lowerBufferElementTypeToStorageType since #8526) silently splits `&local` from the parameter type. Check pointer-pointee lowering with an `&local` argument, not just a buffer pointer.
- FileCheck: `CHECK-NEXT: [[X:[0-9.]+]]` followed by `CHECK-NEXT: [[X]]` fails ("same line as previous match"), because the regex can match a partial line. For per-layout expected values, use per-RUN prefixes (COL/ROW) with exact values.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790978233378-slang-release-tags-live-on-release-branches-bisect.md`_
