---
title: "slang #11629 — reporter's root cause contradicted by HEAD; verify propagation before fixing coverage-manifest gaps"
type: learning
topic: slang-compiler
source: learnings/1781626696031-slang-11629-reporter-s-root-cause-contradicted-by-.md
---

# slang #11629 — reporter's root cause contradicted by HEAD; verify propagation before fixing coverage-manifest gaps

When triaging shader-slang/slang#11629 (no `.coverage-manifest.json` written for metallib/metallib-asm under `-trace-coverage`), the reporter's stated root cause — "coverage metadata not propagated through the Metal `xcrun` downstream step" — was **contradicted by HEAD (5353bc5c3)**. The propagation copy already exists and was verified by direct read:

- `source/slang/slang-code-gen.cpp:1025-1032` — `emitWithDownstreamForEntryPoints` copies ALL `sourceArtifact->getAssociated()` onto the new metallib artifact after the downstream compile (generic, present since Jul 2025).
- `source/slang/slang-code-gen.cpp:1113-1133` — the `*Assembly` disassembly path (incl. `MetalLibAssembly`) copies `Metadata`/`PostEmitMetadata` associations onto the disassembly artifact, gated on finding coverage metadata on the intermediate. **This block was added by the reporter's own coverage PR #11336.**

So the reporter's suggested fixes (add propagation; or walk the associated chain in `_findCoverageTracingMetadata`) are both likely **no-ops**.

**The non-obvious trap:** `_findCoverageTracingMetadata` (`slang-end-to-end-request.cpp:440-452`) returns null in TWO cases, not one: (a) no metadata associated on the leaf, OR (b) metadata present but the non-empty guard at **line 449** fails — `coverage && (getCounterCount()!=0 || getEntryCount()!=0)`. When the manifest is skipped *entirely* (vs written-but-incomplete, which the team assumed in PR #11610 when relaxing the test to `StructureOnly`), the most likely cause is that the coverage metadata reaching the metallib leaf is **empty** (0 entries + 0 counters), not missing — possibly tied to the still-open #11174 (Metal coverage binding path).

**Lesson:** For "sidecar/metadata not written for target X" bugs, don't accept "not propagated" at face value — read the downstream-compile association-copy sites AND the leaf consumer's non-empty/validity guard. Empty-but-present metadata fails the same early-exit as absent metadata, and the fix is at the producer (entry/counter synthesis), not the propagation or the leaf lookup. Also: a reporter-claimed `expected-failure-*.txt` workaround may not actually be on master — grep to confirm; if absent, the nightly is likely red.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781626696031-slang-11629-reporter-s-root-cause-contradicted-by-.md`_
