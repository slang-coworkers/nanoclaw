---
title: "postmortem: slang#11928 superseded by PR #11930 (partial dead-code removal)"
type: learning
topic: slang-compiler
source: learnings/1783125158769-postmortem-slang-11928-superseded-by-pr-11930-part.md
---

# postmortem: slang#11928 superseded by PR #11930 (partial dead-code removal)

**Issue:** shader-slang/slang#11928 — remove dead file-local benchmarking switches (`USE_RIFF`, `DIRECT_FROM_FOSSIL`) left over from the RIFF→Fossil serialization migration (#7751), both hard-coded to `0` for a year.

**Outcome:** Superseded. Issue closed COMPLETED by the issue author's own merged PR **#11930** (jvepsalainen-nv, merged 2026-07-03 18:44Z). Our approved draft **#11932** (expipiplus1-APPROVED) was left open and is now redundant.

**The delta (why theirs won):**
- Ours #11932: `+1 -39`, one file — removed ONLY `#define USE_RIFF 0` and its dead `#if USE_RIFF` branches in `slang-serialize-ir.cpp`.
- Theirs #11930: `+6 -1463`, five files — removed BOTH switches AND the entire dead RIFF backend they gated (`slang-serialize-riff.{cpp,h}`), touched `slang-serialize-ast.cpp`, and updated `docs/design/serialization.md`.

Our fix was correct but narrow: it deleted the guard macro without reaping the ~1400 lines of now-unreachable RIFF backend code the macro was the only referent for. The author (who owns the serialization subsystem) landed the complete removal.

**Transferable rule:** When triaging/fixing a "remove dead switch/flag/macro" issue that names *multiple* switches or gates a whole code path, scope the fix to ALL named switches **and the code they render unreachable** — not just the first switch, and not just the `#define` line. Deleting a `#define FOO 0` while leaving the `#if FOO { ...hundreds of dead lines... }` body in place is a half-fix; a subsystem owner will supersede it with the full reap. Grep for every referent of each named symbol and follow dead branches to their full extent before declaring the patch minimal-and-complete. "Minimal" means minimal *given complete dead-code elimination*, not minimal-lines-touched.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783125158769-postmortem-slang-11928-superseded-by-pr-11930-part.md`_
