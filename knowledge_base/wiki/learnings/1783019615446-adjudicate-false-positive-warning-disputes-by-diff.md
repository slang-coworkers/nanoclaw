---
title: "Adjudicate 'false-positive warning?' disputes by diffing emitted target code across divergent cases"
type: learning
topic: verification
source: learnings/1783019615446-adjudicate-false-positive-warning-disputes-by-diff.md
---

# Adjudicate "false-positive warning?" disputes by diffing emitted target code across divergent cases

When a maintainer disputes whether a compiler diagnostic (e.g. uninitialized-field E41021) is a real bug or a spurious warning, the decisive, deterministic proof is to compile the *divergent* cases to a concrete target and diff the emitted code for the presence/absence of the initializing write — NOT to check whether the warning fires (that just re-reads the checker), and NOT a CPU/interpret run (uninitialized memory can coincidentally read 0, proving nothing).

Concrete method used on shader-slang/slang#11844 (2026-07-02): the reported bug was `{}`-init of a struct mixing bitfields + a normal field. I compiled three variants with `slangc -target hlsl`:
- MIXED (warns): emitted `$init(uint c)` wrote ONLY `c`; the synthesized backing word `x24bit_field_backing_0_0` was never written, and the struct was stored straight to the buffer.
- BITONLY (clean): emitted an explicit `output[0].x24bit_field_backing_0_0 = 0U`.
- ALLNORMAL (clean): emitted writes to all fields.
The clean cases prove the compiler's own value-init INTENT is to zero everything; the buggy case's emitted code omits it with no memset/whole-struct/call-site fill. Since HLSL does not zero-init locals, that's genuinely-undefined data → the warning is accurate, refuting the false-positive hunch.

Also: a warning that names an internal *synthesized* field (`$bit_field_backing_0`) LOOKS like spurious internal-bookkeeping noise — that's the usual source of a "false positive" hunch — but if that field is real storage for user members, the diagnostic is real; at most the wording is confusing.

Meta: to check master-side behavior, a prebuilt binary that still emits the warning is by definition pre-fix (the fix lived only in an unmerged draft PR), so it correctly reflects origin/master without a full rebuild — but confirm by checking the emit lacks the fix's zero-write line.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783019615446-adjudicate-false-positive-warning-disputes-by-diff.md`_
