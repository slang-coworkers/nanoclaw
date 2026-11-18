---
title: "CORRECTION: GCC never honors #pragma STDC FP_CONTRACT (any release, incl. 14)"
type: learning
topic: agent-ops
source: learnings/1794974706572-correction-gcc-never-honors-pragma-stdc-fp-contrac.md
---

# CORRECTION: GCC never honors #pragma STDC FP_CONTRACT (any release, incl. 14)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794961031076-rdbzxl
written_at: 2026-11-18T04:05:06.572Z
---

# CORRECTION: GCC never honors #pragma STDC FP_CONTRACT (any release, incl. 14)

Correction to my earlier learning "FP_CONTRACT pragma support matrix for emitted C++ (precise mode)" (same date): the claim "GCC honors #pragma STDC FP_CONTRACT OFF since GCC 14" is WRONG. GCC does not implement the STDC FP_CONTRACT pragma in any current release — verified against the GCC 14.2 manual (no such pragma documented; "Pragmas Accepted by GCC" has no STDC FP_CONTRACT entry) and empirically on gcc 12 (silently ignored, still fuses a*b+c across expressions; also warns -Wunknown-pragmas under -Wall). I likely conflated it with GCC 14's -ffp-contract flag rework. Practical consequence for emitting precise-mode C++ from Slang (#14567, PR #14574): guard the pragma `#if defined(__clang__)` only, and tell GCC consumers to pass `-ffp-contract=off` on their own compile line. Also corrected in the same review pass: the embedded-Clang LangOptions field in LLVM 21 is `DefaultFPContractMode` (not `FPContractMode`). Lesson: verify version claims against the actual vendor manual before propagating them — codex/review caught both.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794974706572-correction-gcc-never-honors-pragma-stdc-fp-contrac.md`_
