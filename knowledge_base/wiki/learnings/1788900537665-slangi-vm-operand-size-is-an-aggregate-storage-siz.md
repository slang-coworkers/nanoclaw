---
title: "slangi VM operand .size is an aggregate/storage size, not the scalar width — extracted sub-objects keep their container's size"
type: learning
topic: agent-ops
source: learnings/1788900537665-slangi-vm-operand-size-is-an-aggregate-storage-siz.md
---

# slangi VM operand .size is an aggregate/storage size, not the scalar width — extracted sub-objects keep their container's size

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788891906883-5yhyol
written_at: 2026-09-08T20:48:57.665Z
---

# slangi VM operand .size is an aggregate/storage size, not the scalar width — extracted sub-objects keep their container's size

When fixing a slangi (bytecode VM) width bug, do NOT assume a `Print`/operand's `.size` equals the scalar it addresses. `allocReg` records the exact type size, but **`FieldExtract` and constant-index `GetElement` (`source/slang/slang-emit-vm.cpp`, ~lines 979/995) build their operand by copying the *containing* value's operand and only shifting the offset — the `.size` stays the enclosing aggregate's size.** So a 4-byte `float` field (e.g. an autodiff `DifferentialPair<float>.d`) has an operand with `size == 8`. `tests/byte-code/bwd-diff-call-arg-oob.slang` exercises exactly this.

Consequence for #12964 (slangi printf reading a `double` at float width): the triage's premise "Print operand size == IR scalar width (float→4, double→8)" was FALSE. A size-based "8 bytes ⇒ read a double" heuristic misreads a padded/aliased `float` as a `double` and regresses the autodiff byte-code tests. The principled fix is producer-side: at `kIROp_Printf` emission, pin a float/double arg operand's `.size` to its own `getNaturalSizeAndAlignment` size (overriding the inherited aggregate size), then thread that width to the formatter (`printHandler` → `makeStringWithFormatFromArgArray`), which reads `double` iff width==8 else `float`. This also fixes the `printHandler` memcpy over-read and needs no float→double promotion and no `l`/`L` fallback (the width is authoritative; a `float` promotes to `double` at the vsnprintf boundary, so `%lf` on a float reads 4 bytes and still prints correctly).

Method note: verify operand widths empirically (run the repro/suite and observe which values misread), not from a size assumption — and disasm `.size` for extracted values, since `slangi <file> -disasm` may only print program output for files with a `main`.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1788900537665-slangi-vm-operand-size-is-an-aggregate-storage-siz.md`_
