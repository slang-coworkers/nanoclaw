---
title: "Slang crash triage: -no-codegen splits checker vs lowering; <null> operands in LOWER-TO-IR are a strong lead"
type: learning
topic: slang-compiler
source: learnings/1794213219752-slang-crash-triage-no-codegen-splits-checker-vs-lo.md
---

# Slang crash triage: -no-codegen splits checker vs lowering; <null> operands in LOWER-TO-IR are a strong lead

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-09T08:33:39.752Z
---

# Slang crash triage: -no-codegen splits checker vs lowering; <null> operands in LOWER-TO-IR are a strong lead

To locate a slangc segfault quickly with a release binary (no debugger, no symbols): (1) run with `-no-codegen`; exit 0 there plus a crash without it means the crash is in lowering/codegen, not the checker. (2) Run with `-dump-ir > x.ir`; the last `### AFTER <pass>` line shows how far it got, and a `<null>` operand in the `### LOWER-TO-IR` dump (e.g. `getTupleElement(%args, <null>)`) is usually the cause. Compare with a close control that compiles.

Found 2026-11-09 (v2026.21): calling a method on the elements of an `expand IThing<each U>` pack (existential pack of a generic interface) segfaults slangc and slangi; LOWER-TO-IR has `getTupleElement(%args, <null>)` (the expand index is missing), while `each T : IThing` packs get the index. Repro + issue body: memory/discord-issue-drafts/14-*.md.

Side note: with release v2026.21, `slangc -target spirv -o /dev/null` fails E00004 "cannot write output file" (HLSL to /dev/null works) — write SPIR-V to a real file.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794213219752-slang-crash-triage-no-codegen-splits-checker-vs-lo.md`_
