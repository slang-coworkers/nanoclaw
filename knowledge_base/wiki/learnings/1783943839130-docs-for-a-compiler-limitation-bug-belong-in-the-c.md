---
title: "Docs for a compiler-limitation bug belong in the compiler repo, not the wrapper repo (SlangPy → Slang)"
type: learning
topic: slang-compiler
source: learnings/1783943839130-docs-for-a-compiler-limitation-bug-belong-in-the-c.md
---

# Docs for a compiler-limitation bug belong in the compiler repo, not the wrapper repo (SlangPy → Slang)

**Process lesson from slangpy#1059 → PR #1060 (closed) → slang#12073.** When a SlangPy issue's root cause is a **Slang compiler behavior that SlangPy is transparent to** (no lever in-repo — the classic "Track A upstream / Track B slangpy-docs" split), the natural instinct is to land a mitigation **docs note in the SlangPy repo**. That was done here (PR #1060: `docs/src/basics/cuda_performance.rst`), peer-approved and maintainer-aligned on content — **and the SlangPy maintainer (skallweitNV) then closed it (not merged), directing the note to the Slang docs instead.**

**His reasoning (correct on the merits):** a note describing a compiler limitation, kept in the *wrapper* repo, has a high risk of **drifting out of sync** with the actual compiler behavior. Its canonical home is the **compiler docs, co-located with the fix/tracking issue** (slang#12073). If the wrapper repo wants discoverability, the most a maintainer will accept is a **generic pointer** ("for current Slang limitations & perf notes, see [Slang docs]") — **not** an issue-specific copy that can rot.

**Actionable takeaway for triage/planning:** For a "compiler-limitation, wrapper-transparent" bug, don't default Track B to a full docs note in the wrapper repo. Either (a) propose the docs note in the **compiler repo** from the start (co-located with the upstream fix), or (b) if you do draft it in the wrapper repo, **flag the drift risk and the home-repo question to the maintainer early** rather than after a full reviewed PR. Track B "SlangPy-actionable docs note" may legitimately collapse into "Slang-docs task + at most a generic pointer" once a maintainer weighs in. Closing the wrapper-repo docs PR in this situation is a **scope correction, not a failure**.

**Chain-mechanics note:** the Slang-docs authoring is a **cross-project hop** — the slangpy chain (triager/fixer) must NOT self-author it or file it upstream directly; route it through the parent/orchestrator to the slang side (same boundary as the Track-A codegen fix). Tier-skipping into the slang chain corrupts parent topology.

Related: the corrected root-cause mechanism is in "CORRECTION: Slang float3 CUDA slowdown is swizzle-base re-evaluation, NOT vec3 layout/register pressure".

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783943839130-docs-for-a-compiler-limitation-bug-belong-in-the-c.md`_
