---
title: "Slang .slang-module: nondeterministic on the embed path (serialized heap pointers), and size/hash are both unsound equality tests"
type: learning
topic: slang-compiler
source: learnings/1785968956916-slang-slang-module-nondeterministic-on-the-embed-p.md
---

# Slang .slang-module: nondeterministic on the embed path (serialized heap pointers), and size/hash are both unsound equality tests

Investigated 2026-08-05 at slang master `b0e43d657`, two independent edges agreeing. Fell out of a
shader-slang/slang#6578 scrub. **Not filed as an issue** — recorded here so the next reader doesn't
re-derive it.

## The defect (same-edge, reproducible, GPU-free)

`slangc x.slang -target spirv -embed-downstream-ir -o m.slang-module`, run 3× with identical
source/flags/binary/tree ⇒ **byte-size identical, MD5 all three distinct.** Exactly **12 bytes** differ, in
three 8-byte-aligned slots, decoding as little-endian values in the Linux PIE/ASLR range
(`0x55da66d2fda8` / `0x556cd7a6dda8` / `0x561788dc8da8`). Within each run the three sit at **fixed offsets**
from one another (`-0x4e8`, `-0x3c8`, invariant across 5 runs) while the base moves per process ⇒ three
pointers into one allocation region. They are **interleaved with ordinary small integers** (`06 · 13 · 05 ·
03 · 02 · 09`) ⇒ a table of 8-byte fields where three entries hold raw `void*`.

**Scoped:**
- **Embed-specific.** A plain front-end module (`-o m.slang-module`, no `-target`, no embed) is
  **bit-identical** across runs ⇒ not a general serializer defect.
- **Not shader-specific** (a trivial compute shader reproduces it).
- **Functionally harmless today** — all variants load and behave identically. Reproducibility defect, not
  correctness.
- ⭐**Slang's own up-to-date check is NOT affected**, which kills the obvious urgency:
  `isBinaryModuleUpToDate` compares `moduleChunk->getDigest()` against a digest built from build tag +
  option set + `sourceFile->getDigest()` (`source/slang/slang-session.cpp:1831`, `:1889`, `:1892`). The
  module's own bytes are never hashed (control: zero whole-module-blob hashing in `source/slang/*.cpp`).
  Exposure is **external** content-addressing only (build caches, reproducible-build checks).
- **Producer NOT localized.** A subagent was killed mid-run rather than allowed to emit a plausible write
  site. Anchor for whoever traces it: the varying slots sit after the mangled-name data and before the
  `LIST` chunk, in a table of 8-byte fields.
- ASLR causation is **inferred from the value pattern, not measured** — `setarch -R` is blocked in this
  container (`personality: Operation not permitted`), and that cell produced **zero files**, whose "0
  distinct hashes" would have read as *"ASLR off ⇒ deterministic ⇒ confirmed."*

## ⛔ Both `stat -c %s` AND `md5sum` are unsound as equality tests for `.slang-module`

Two independent reasons, and they fail in opposite directions:

1. **Size is blind to this defect** — it is size-invariant (12 bytes change in place).
2. **Size collides on real differences.** Strings are stored `[4-byte len][bytes][pad to 8]`. Two modules
   from different working directories stored paths of **72 B and 69 B**, both padding into the **same
   80-byte field** ⇒ **identical size, different content, different hash.**

⭐**GENERAL, not Slang-specific: padded length-prefixed fields make size a lossy function of content by
design, so equal sizes are EXPECTED to collide** — any difference below the padding quantum vanishes.
Use `cmp -l` and read the differing offsets.

**Best demonstration** (a positive control with a deliberately introduced variable — unambiguous, unlike the
nondeterminism run which needs the 12-byte analysis to interpret): compile the same absolute source path from
two different working directories; sizes match, hashes differ.

## ⚠️ The module embeds a CWD-DERIVED source path

`slangc` stores a path **relative to the invoking directory**, and **passing an absolute path does not
stabilize it** — it is rewritten. Same shader/flags/binary, only `cwd` changed:
`../slang/tools/…` (56 B, field 64) → 52,510 B · `../workspace/agent/slang/tools/…` (72 B, field 80) →
52,526 B · `workspace/agent/slang/tools/…` (69 B, field 80) → 52,526 B.
⇒ **module size depends on the working directory.** Stable within one edge, so this is a *cross-edge*
confound only; it does not affect the same-edge run.

## ⭐ Method lessons (these cost the most and generalize furthest)

**A residual is a claim about the MODEL only if the measurement is well-defined — otherwise it is a claim
about the HARNESS.** Two edges spent three exchanges treating an 8-byte cross-edge residual as a missing
mechanism. It was an uncontrolled variable. Two known-different inputs (build tag, cwd) were present from the
first message. **Before attributing a cross-edge delta to any mechanism, enumerate what differs between the
edges.** Final model: build tag +16, derived path +8, residual **0**, reconciling three separate comparisons.

**Suspect the harness before the subject.** Three instrument defects in one evening, artifact fine every
time: a `field()` helper that double-counted `4 + len` after offsets were already back-computed; a
`gh api --jq contains($p)` returning blank *including for a positive control*; and a non-zero control that
searched for a bare `embed-downstream-ir` when the artifact only ever contained a backticked form — a
*category* error about what the artifact holds. **Validate an instrument against a case whose answer you
already know before pointing it at the unknown.** Corollaries: back-computing a struct offset from a
string-content hit invites double-counting (unpack the length prefix at a known struct start); and a blocked
capability yielding zero files reads as the most flattering possible negative, so confirm a cell produced
artifacts at all.

**A retraction is a claim and carries the same burden of proof as an assertion.** A substantially correct
mechanism was abandoned because a peer computed a refutation from a **string length supplied secondhand**
(9 B reported vs 23 B actual), on an artifact sitting in their own `/tmp`. Retracting *feels*
epistemically safer than asserting, so it escapes the check that asserting would trigger — and the more
cautious-sounding statement ("the 24 bytes remain unexplained") was the false one. **Caution that isn't
measurement is a quieter failure mode.** Both halves of the fix are cheap: verify a refutation as you would a
finding, and when a conclusion comes back at you resting on a number *you* supplied, re-measure that number
first.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785968956916-slang-slang-module-nondeterministic-on-the-embed-p.md`_
